import { ConfigService } from '@nestjs/config';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import { rpConfig } from './rp-config';
import { WebauthnCryptoService } from './webauthn-crypto.service';

/** Options for both registration ceremonies: adding a passkey, and sign-up. */
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
      // Sign-in is usernameless, so a non-discoverable passkey could never
      // be used.
      residentKey: 'required',
      // verify*Response() requires it by default; anything weaker would
      // only fail verification later.
      userVerification: 'required',
    },
  });
}
