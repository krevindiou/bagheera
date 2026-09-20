import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { webauthnCredential } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { requireMemberId } from '../session/require-member-id';

export interface WebauthnCredentialSummary {
  id: string;
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

// Authentication is passkey-only with no password fallback and no account
// recovery — deleting your last remaining passkey would be a permanent,
// total lockout from a single settings click. Blocked below, not just
// discouraged.
const LAST_PASSKEY_ERROR = 'Cannot remove your last passkey — it would lock you out permanently.';

/** Listing/removal for a member's own passkeys — never exposes the public key or counter. */
@Injectable()
export class WebauthnCredentialsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly audit: AuditService,
  ) {}

  async list(req: Request): Promise<WebauthnCredentialSummary[]> {
    const memberId = requireMemberId(req);
    const rows = await this.db
      .select({
        id: webauthnCredential.id,
        deviceName: webauthnCredential.deviceName,
        createdAt: webauthnCredential.createdAt,
        lastUsedAt: webauthnCredential.lastUsedAt,
      })
      .from(webauthnCredential)
      .where(eq(webauthnCredential.memberId, memberId));
    return rows;
  }

  async remove(req: Request, id: string): Promise<void> {
    const memberId = requireMemberId(req);

    await this.db.transaction(async (tx) => {
      const owned = await tx
        .select({ id: webauthnCredential.id })
        .from(webauthnCredential)
        .where(eq(webauthnCredential.memberId, memberId));
      if (!owned.some((row) => row.id === id)) {
        throw new NotFoundException();
      }
      if (owned.length <= 1) {
        throw new BadRequestException(LAST_PASSKEY_ERROR);
      }

      await tx
        .delete(webauthnCredential)
        .where(and(eq(webauthnCredential.id, id), eq(webauthnCredential.memberId, memberId)));
    });

    await this.audit.record('webauthn_credential_removed', memberId, req.ip ?? 'unknown');
  }
}
