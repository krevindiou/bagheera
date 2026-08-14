import { CryptoService } from '../security/crypto.service';

// Password-reset links expire after 1 hour (shorter-lived than
// activation's 24h since the exposure window matters more here).
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface ResetTokenPayload {
  type: 'reset';
  email: string;
  /** Must match the member's current `passwordResetTokenVersion`; a
   * password change (either flow) bumps the stored version, invalidating
   * every outstanding reset key. */
  version: number;
  /** Epoch milliseconds. */
  exp: number;
}

export function buildResetToken(
  crypto: CryptoService,
  email: string,
  version: number,
): string {
  const payload: ResetTokenPayload = {
    type: 'reset',
    email,
    version,
    exp: Date.now() + RESET_TOKEN_TTL_MS,
  };
  return crypto.encrypt(JSON.stringify(payload));
}

/**
 * Decrypts and validates the shape/expiry of a reset key. Returns `null`
 * for anything wrong with the token itself — tampered/malformed
 * ciphertext, bad JSON, wrong shape, expired — never throws.
 */
export function parseResetToken(
  crypto: CryptoService,
  key: string,
): ResetTokenPayload | null {
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

  if (!isResetTokenPayload(parsed)) {
    return null;
  }
  if (parsed.exp <= Date.now()) {
    return null;
  }
  return parsed;
}

function isResetTokenPayload(value: unknown): value is ResetTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'reset' &&
    typeof candidate.email === 'string' &&
    typeof candidate.version === 'number' &&
    typeof candidate.exp === 'number'
  );
}
