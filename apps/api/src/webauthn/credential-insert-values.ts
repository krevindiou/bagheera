import type { VerifiedRegistrationResponse } from '@simplewebauthn/server';
import type { webauthnCredential } from '../db/schema';

/** A verified registration as a `webauthn_credential` row, for both ceremonies. */
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
