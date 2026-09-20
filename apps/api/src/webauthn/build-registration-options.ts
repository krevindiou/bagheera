import { ConfigService } from '@nestjs/config';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import { rpConfig } from './rp-config';
import { WebauthnCryptoService } from './webauthn-crypto.service';

/**
 * Shared option-building for both WebAuthn registration ceremonies — the
 * authenticated "add a passkey" flow (webauthn-registration.service.ts) and
 * the unauthenticated sign-up ceremony (webauthn-signup.service.ts). Only
 * `userName`/`excludeCredentials` differ between the two; everything else
 * (rpID/rpName, authenticatorSelection) is identical.
 */
export function buildRegistrationOptions(
  crypto: WebauthnCryptoService,
  config: ConfigService,
  params: { userName: string; excludeCredentials: { id: string; transports?: string[] }[] },
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const { rpID, rpName } = rpConfig(config);
  return crypto.generateRegistrationOptions({
    rpName,
    rpID,
    userName: params.userName,
    // Lets the authenticator prompt "you already have a passkey here"
    // instead of silently creating a duplicate for the same device.
    excludeCredentials: params.excludeCredentials,
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'preferred',
    },
  });
}
