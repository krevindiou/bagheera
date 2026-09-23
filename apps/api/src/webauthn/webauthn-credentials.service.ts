import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { member, webauthnCredential } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { passkeyRemovedEmail } from '../email/templates/passkey-removed.template';
import { AuditService } from '../security/audit.service';
import { consumeStepUp } from '../session/consume-step-up';
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
    private readonly emailQueue: EmailQueueService,
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

  // Step-up gated like registration (see WebauthnRegistrationService): a
  // hijacked session that could delete passkeys would, right after planting
  // its own, lock the real owner out for good — there's no recovery path.
  // The alert email mirrors registration's for the same reason.
  async remove(req: Request, id: string): Promise<void> {
    const memberId = requireMemberId(req);
    consumeStepUp(req);

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

    const [row] = await this.db
      .select({ email: member.email, locale: member.locale })
      .from(member)
      .where(eq(member.id, memberId));
    if (row) {
      await this.emailQueue.enqueue(passkeyRemovedEmail(row.email, row.locale));
    }
    await this.audit.record('webauthn_credential_removed', memberId, req.ip ?? 'unknown');
  }
}
