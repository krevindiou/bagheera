import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { webauthnCredential } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { requireMemberId } from '../session/require-member-id';

export interface WebauthnCredentialSummary {
  id: number;
  deviceName: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}

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

  async remove(req: Request, id: number): Promise<void> {
    const memberId = requireMemberId(req);
    const result = await this.db
      .delete(webauthnCredential)
      .where(
        and(
          eq(webauthnCredential.id, id),
          eq(webauthnCredential.memberId, memberId),
        ),
      )
      .returning({ id: webauthnCredential.id });

    if (result.length === 0) {
      throw new NotFoundException();
    }

    await this.audit.record(
      'webauthn_credential_removed',
      memberId,
      req.ip ?? 'unknown',
    );
  }
}
