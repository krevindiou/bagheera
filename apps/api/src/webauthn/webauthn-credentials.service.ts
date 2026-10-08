import { HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { BusinessError } from '../common/filters/business-error';
import { DRIZZLE } from '../db/db.constants';
import { member, webauthnCredential } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { passkeyRemovedEmail } from '../email/templates/passkey-removed.template';
import { AuditService } from '../security/audit.service';
import { consumeStepUp } from '../session/consume-step-up';
import { SessionRegistryService } from '../session/session-registry.service';
import { requireMemberId } from '../session/require-member-id';
import { WebauthnCredentialSummaryDto } from './dto/webauthn-credential-response.dto';

export type WebauthnCredentialSummary = WebauthnCredentialSummaryDto;

// No password and no account recovery: removing the last passkey would be
// a permanent lockout.
const LAST_PASSKEY_ERROR = 'Cannot remove your last passkey — it would lock you out permanently.';

/** Listing/removal for a member's own passkeys — never exposes the public key or counter. */
@Injectable()
export class WebauthnCredentialsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly emailQueue: EmailQueueService,
    private readonly audit: AuditService,
    private readonly sessionRegistry: SessionRegistryService,
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

  // Step-up gated and alerted like registration: a hijacked session could
  // otherwise plant its own passkey, then delete the owner's.
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
        throw new BusinessError(HttpStatus.BAD_REQUEST, 'last_passkey', LAST_PASSKEY_ERROR);
      }

      await tx
        .delete(webauthnCredential)
        .where(and(eq(webauthnCredential.id, id), eq(webauthnCredential.memberId, memberId)));
    });

    // The removed passkey may be the compromised one: any other session
    // could belong to whoever holds it.
    await this.sessionRegistry.revokeOthers(memberId, req.sessionID);

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
