import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { SchedulerCatchUpService } from '../auth/scheduler-catch-up.service';
import { BusinessError } from '../common/filters/business-error';
import { effectiveTimeZone } from '../common/member-today';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { EmailQueueService } from '../email/email-queue.service';
import { enqueueAlert } from '../email/enqueue-alert';
import { signInEmail } from '../email/templates/sign-in.template';
import { AuditService } from '../security/audit.service';
import { storeChallenge, takeChallenge } from '../session/challenge';
import { recordSessionClient } from '../session/record-session-client';
import { SessionRegistryService } from '../session/session-registry.service';
import { SessionRotationService } from '../session/session-rotation.service';
import { SingleUseStore } from '../session/single-use-store';
import { VerifyAuthenticationDto } from './dto/verify-authentication.dto';
import { rpConfig } from './rp-config';
import { WebauthnAssertionService } from './webauthn-assertion.service';
import { WebauthnCryptoService } from './webauthn-crypto.service';
import { clientIp } from '../common/client-ip.decorator';

// Unknown/removed credential and a bad signature are indistinguishable —
// one generic error path for both. A bare 401 here is safe: this only ever
// fires from the sign-in page, so the web client's global 401 handler
// redirecting to sign-in is a no-op there.
const INVALID_PASSKEY = 'Passkey sign-in failed.';

function invalidPasskey(): BusinessError {
  return new BusinessError(HttpStatus.UNAUTHORIZED, 'passkey_sign_in_failed', INVALID_PASSKEY);
}

function saveSession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.save((err) => (err ? reject(toError(err)) : resolve()));
  });
}

function destroySession(req: Request): Promise<void> {
  return new Promise((resolve, reject) => {
    req.session.destroy((err) => (err ? reject(toError(err)) : resolve()));
  });
}

function toError(err: unknown): Error {
  return err instanceof Error ? err : new Error(String(err));
}

/**
 * The sole, usernameless sign-in: options() names no credentials, so the
 * authenticator offers its discoverable passkeys for this site, and
 * verify() learns the member from the one that answered. Asking for an
 * email would reveal which addresses are registered and allow per-email
 * lockouts. Ends by rotating the session, then setting memberId and the
 * member's session epoch, and emails the member a notice of the sign-in.
 */
@Injectable()
export class WebauthnAuthenticationService {
  private readonly logger = new Logger(WebauthnAuthenticationService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly crypto: WebauthnCryptoService,
    private readonly assertion: WebauthnAssertionService,
    private readonly sessionRotation: SessionRotationService,
    private readonly sessionRegistry: SessionRegistryService,
    private readonly schedulerCatchUp: SchedulerCatchUpService,
    private readonly audit: AuditService,
    private readonly singleUse: SingleUseStore,
    private readonly emailQueue: EmailQueueService,
  ) {}

  async generateOptions(req: Request): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const options = await this.crypto.generateAuthenticationOptions({
      rpID: rpConfig(this.config).rpID,
      allowCredentials: [],
      userVerification: 'required',
    });
    await storeChallenge(this.singleUse, req, 'webauthnChallenge', {
      challenge: options.challenge,
    });
    return options;
  }

  async verify(req: Request, dto: VerifyAuthenticationDto): Promise<{ message: string }> {
    const sourceAddress = clientIp(req);
    // Taken before the session id rotates below.
    const pending = await takeChallenge(this.singleUse, req, 'webauthnChallenge');

    if (!pending) {
      await this.audit.record('webauthn_sign_in_failure', null, sourceAddress);
      throw invalidPasskey();
    }

    const credentialRow = await this.assertion.findCredential(dto.response.id);
    if (!credentialRow) {
      await this.audit.record('webauthn_sign_in_failure', null, sourceAddress);
      throw invalidPasskey();
    }
    const memberId = credentialRow.memberId;

    const verification = await this.assertion.verify(
      credentialRow,
      dto.response,
      pending.challenge,
    );
    if (!verification.verified) {
      await this.audit.record('webauthn_sign_in_failure', memberId, sourceAddress);
      throw invalidPasskey();
    }

    const [row] = await this.db.select().from(member).where(eq(member.id, memberId));
    if (!row) {
      await this.audit.record('webauthn_sign_in_failure', memberId, sourceAddress);
      throw invalidPasskey();
    }

    if (!(await this.assertion.recordUse(credentialRow, verification.newCounter))) {
      await this.audit.record('webauthn_sign_in_failure', memberId, sourceAddress);
      throw invalidPasskey();
    }

    await this.sessionRotation.rotate(req);
    req.session.memberId = row.id;
    req.session.sessionEpoch = row.sessionEpoch;
    recordSessionClient(req);
    await this.sessionRegistry.register(row.id, req.sessionID);
    await saveSession(req);

    // A removal of this passkey committed after recordUse() either shows up
    // here, or its revocation runs after register() and so reaches this
    // session.
    if (!(await this.assertion.findCredential(dto.response.id))) {
      await destroySession(req);
      await this.audit.record('webauthn_sign_in_failure', memberId, sourceAddress);
      throw invalidPasskey();
    }

    const signedInAt = new Date();
    await this.db.update(member).set({ loggedAt: signedInAt }).where(eq(member.id, row.id));

    await this.schedulerCatchUp.catchUp(row.id);
    await this.audit.record('webauthn_sign_in_success', row.id, sourceAddress);
    // Signed in: a queue outage may neither fail the sign-in nor hold it up.
    void enqueueAlert(
      this.emailQueue,
      this.logger,
      signInEmail(
        row.email,
        {
          at: signedInAt,
          timeZone: effectiveTimeZone(row.timeZone),
          deviceName: credentialRow.deviceName,
          sourceAddress,
        },
        row.locale,
      ),
    );

    return { message: 'ok' };
  }
}
