import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  AuthenticationResponseJSON,
  VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { webauthnCredential } from '../db/schema';
import { rpConfig } from './rp-config';
import { verificationFailureReason } from './verification-failure';
import { WebauthnCryptoService } from './webauthn-crypto.service';

export type WebauthnCredentialRow = typeof webauthnCredential.$inferSelect;

export type AssertionVerification = { verified: true; newCounter: number } | { verified: false };

/**
 * The assertion check shared by sign-in and step-up. Split into steps so
 * each caller can apply its own policy (ownership, audit, member lookup)
 * between them, before anything is written.
 */
@Injectable()
export class WebauthnAssertionService {
  private readonly logger = new Logger(WebauthnAssertionService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly config: ConfigService,
    private readonly crypto: WebauthnCryptoService,
  ) {}

  async findCredential(credentialId: string): Promise<WebauthnCredentialRow | undefined> {
    const [row] = await this.db
      .select()
      .from(webauthnCredential)
      .where(eq(webauthnCredential.credentialId, credentialId));
    return row;
  }

  // A throw from the library (malformed response, wrong challenge/origin)
  // counts as a failed verification, same as `verified: false`; it is logged
  // so a misconfigured RP_ID/RP_ORIGIN can be told apart from a bad client.
  async verify(
    credential: WebauthnCredentialRow,
    response: AuthenticationResponseJSON,
    expectedChallenge: string,
  ): Promise<AssertionVerification> {
    let verification: VerifiedAuthenticationResponse;
    try {
      const { origin, rpID } = rpConfig(this.config);
      verification = await this.crypto.verifyAuthenticationResponse({
        response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: credential.credentialId,
          publicKey: Buffer.from(credential.publicKey, 'base64'),
          counter: credential.counter,
          transports: credential.transports ?? undefined,
        },
      });
    } catch (err) {
      this.logger.warn(`Passkey assertion rejected: ${verificationFailureReason(err)}`);
      return { verified: false };
    }
    return verification.verified
      ? { verified: true, newCounter: verification.authenticationInfo.newCounter }
      : { verified: false };
  }

  async recordUse(credential: WebauthnCredentialRow, newCounter: number): Promise<void> {
    await this.db
      .update(webauthnCredential)
      .set({ counter: newCounter, lastUsedAt: new Date() })
      .where(eq(webauthnCredential.id, credential.id));
  }
}
