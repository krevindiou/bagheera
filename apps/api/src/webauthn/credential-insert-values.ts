import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import type { webauthnCredential } from '../db/schema';

/**
 * Shared row-shaping between the two WebAuthn registration ceremonies (see
 * build-registration-options.ts) — maps a verified registration response
 * into the `webauthn_credential` insert shape.
 */
export function credentialInsertValues(
  memberId: string,
  registrationInfo: NonNullable<VerifiedRegistrationResponse['registrationInfo']>,
  deviceName?: string,
): typeof webauthnCredential.$inferInsert {
  const { credential } = registrationInfo;
  return {
    memberId,
    credentialId: credential.id,
    publicKey: Buffer.from(credential.publicKey).toString('base64'),
    counter: credential.counter,
    transports: credential.transports ?? null,
    deviceName,
  };
}
