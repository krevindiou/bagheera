import { CryptoService } from '../security/crypto.service';

const ACTIVATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

export interface ActivationTokenPayload {
  type: 'register';
  email: string;
  /** Must match the member's current `activationTokenVersion`; a reissue bumps the stored
   * version, silently invalidating every token minted under the previous one. */
  version: number;
  /** Epoch milliseconds. */
  exp: number;
}

export function buildActivationToken(
  crypto: CryptoService,
  email: string,
  version: number,
): string {
  const payload: ActivationTokenPayload = {
    type: 'register',
    email,
    version,
    exp: Date.now() + ACTIVATION_TOKEN_TTL_MS,
  };
  return crypto.encrypt(JSON.stringify(payload));
}
