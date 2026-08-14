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

/**
 * Decrypts and validates the shape/expiry of an activation key. Returns
 * `null` for anything wrong with the token itself (tampered/malformed
 * ciphertext, bad JSON, wrong shape, expired) — never throws, so callers
 * can collapse every such case into the same generic error path.
 * Does *not* check the member's current activation state or token
 * version; that requires a DB lookup and is the caller's job.
 */
export function parseActivationToken(
  crypto: CryptoService,
  key: string,
): ActivationTokenPayload | null {
  let decrypted: string;
  try {
    decrypted = crypto.decrypt(key);
  } catch {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decrypted);
  } catch {
    return null;
  }

  if (!isActivationTokenPayload(parsed)) {
    return null;
  }
  if (parsed.exp <= Date.now()) {
    return null;
  }
  return parsed;
}

function isActivationTokenPayload(
  value: unknown,
): value is ActivationTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'register' &&
    typeof candidate.email === 'string' &&
    typeof candidate.version === 'number' &&
    typeof candidate.exp === 'number'
  );
}
