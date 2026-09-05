import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  PublicKeyCredentialRequestOptionsJSON,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { SchedulerCatchUpService } from '../auth/scheduler-catch-up.service';
import { DRIZZLE } from '../db/db.constants';
import { member, webauthnCredential } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { SessionRotationService } from '../session/session-rotation.service';
import '../session/webauthn-session-data';
import { AuthenticationOptionsDto } from './dto/authentication-options.dto';
import { VerifyAuthenticationDto } from './dto/verify-authentication.dto';
import { rpConfig } from './rp-config';

// Unknown email, unknown/removed credential, and a bad signature are all
// indistinguishable — same discipline as sign-in.service.ts's
// INVALID_CREDENTIALS. A bare 401 here is safe for the same reason it is on
// the password path: this only ever fires from the sign-in page, so the web
// client's global 401 handler redirecting to sign-in is a no-op there.
const INVALID_PASSKEY = 'Passkey sign-in failed.';

/**
 * The authentication counterpart to WebauthnRegistrationService — a
 * passwordless alternative to sign-in.service.ts's password check, ending in
 * the exact same session-creation step (rotate then set memberId).
 */
@Injectable()
export class WebauthnAuthenticationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly sessionRotation: SessionRotationService,
    private readonly schedulerCatchUp: SchedulerCatchUpService,
    private readonly audit: AuditService,
  ) {}

  async generateOptions(
    req: Request,
    dto: AuthenticationOptionsDto,
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    const [row] = await this.db
      .select()
      .from(member)
      .where(sql`lower(${member.email}) = lower(${dto.email})`);

    let allowCredentials: { id: string; transports?: string[] }[] = [];
    if (row) {
      const credentials = await this.db
        .select()
        .from(webauthnCredential)
        .where(eq(webauthnCredential.memberId, row.id));
      allowCredentials = credentials.map((credential) => ({
        id: credential.credentialId,
        transports: credential.transports ?? undefined,
      }));
    }

    const options = await generateAuthenticationOptions({
      rpID: rpConfig(this.config).rpID,
      allowCredentials,
      userVerification: 'preferred',
    });

    req.session.webauthnChallenge = options.challenge;
    // Anti-enumeration: only stash a resolvable member id when the email
    // matched AND has a credential to authenticate with. Response shape and
    // timing are otherwise identical for an unknown email, so verify()
    // always fails the same way it would for a real member with no match.
    if (row && allowCredentials.length > 0) {
      req.session.webauthnMemberId = row.id;
    } else {
      delete req.session.webauthnMemberId;
    }

    return options;
  }

  async verify(
    req: Request,
    dto: VerifyAuthenticationDto,
  ): Promise<{ message: string }> {
    const sourceAddress = req.ip ?? 'unknown';
    const expectedChallenge = req.session.webauthnChallenge;
    const memberId = req.session.webauthnMemberId ?? null;
    delete req.session.webauthnChallenge;
    delete req.session.webauthnMemberId;

    if (!expectedChallenge || !memberId) {
      await this.audit.record(
        'webauthn_sign_in_failure',
        memberId,
        sourceAddress,
      );
      throw new UnauthorizedException(INVALID_PASSKEY);
    }

    const [credentialRow] = await this.db
      .select()
      .from(webauthnCredential)
      .where(eq(webauthnCredential.credentialId, dto.response.id));
    if (!credentialRow || credentialRow.memberId !== memberId) {
      await this.audit.record(
        'webauthn_sign_in_failure',
        memberId,
        sourceAddress,
      );
      throw new UnauthorizedException(INVALID_PASSKEY);
    }

    let verification: VerifiedAuthenticationResponse;
    try {
      verification = await verifyAuthenticationResponse({
        response: dto.response,
        expectedChallenge,
        expectedOrigin: rpConfig(this.config).origin,
        expectedRPID: rpConfig(this.config).rpID,
        credential: {
          id: credentialRow.credentialId,
          publicKey: Buffer.from(credentialRow.publicKey, 'base64'),
          counter: credentialRow.counter,
          transports: credentialRow.transports ?? undefined,
        },
      });
    } catch {
      await this.audit.record(
        'webauthn_sign_in_failure',
        memberId,
        sourceAddress,
      );
      throw new UnauthorizedException(INVALID_PASSKEY);
    }

    if (!verification.verified) {
      await this.audit.record(
        'webauthn_sign_in_failure',
        memberId,
        sourceAddress,
      );
      throw new UnauthorizedException(INVALID_PASSKEY);
    }

    const [row] = await this.db
      .select()
      .from(member)
      .where(eq(member.id, memberId));
    if (!row || !row.active) {
      await this.audit.record(
        'webauthn_sign_in_failure',
        memberId,
        sourceAddress,
      );
      throw new UnauthorizedException(INVALID_PASSKEY);
    }

    await this.db
      .update(webauthnCredential)
      .set({
        counter: verification.authenticationInfo.newCounter,
        lastUsedAt: new Date(),
      })
      .where(eq(webauthnCredential.id, credentialRow.id));

    await this.sessionRotation.rotate(req);
    req.session.memberId = row.id;

    await this.db
      .update(member)
      .set({ loggedAt: new Date() })
      .where(eq(member.id, row.id));

    await this.schedulerCatchUp.catchUp(row.id);
    await this.audit.record('webauthn_sign_in_success', row.id, sourceAddress);

    return { message: 'ok' };
  }
}
