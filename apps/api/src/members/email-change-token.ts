import { CryptoService } from '../security/crypto.service';

// Shorter-lived than activation's 24h, matching password-reset's reasoning:
// this token proves control of a mailbox that's about to become the
// account's contact address, so the exposure window matters more than
// convenience does.
const EMAIL_CHANGE_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface EmailChangeTokenPayload {
  type: 'email_change';
  /**
   * The member requesting the change, not their (possibly since-changed)
   * email — unlike activation/reset tokens, which are minted before the
   * caller is known any other way, an email change is always requested
   * from an authenticated session, so the stable id is already in hand and
   * is what this token should stay bound to.
   */
  memberId: number;
  newEmail: string;
  /** Must match the member's current `emailChangeTokenVersion`; a fresh
   * change request bumps the stored version, invalidating every
   * outstanding confirmation link minted under the previous one. */
  version: number;
  /** Epoch milliseconds. */
  exp: number;
}

export function buildEmailChangeToken(
  crypto: CryptoService,
  memberId: number,
  newEmail: string,
  version: number,
): string {
  const payload: EmailChangeTokenPayload = {
    type: 'email_change',
    memberId,
    newEmail,
    version,
    exp: Date.now() + EMAIL_CHANGE_TOKEN_TTL_MS,
  };
  return crypto.encrypt(JSON.stringify(payload));
}

/**
 * Decrypts and validates the shape/expiry of an email-change confirmation
 * key. Returns `null` for anything wrong with the token itself —
 * tampered/malformed ciphertext, bad JSON, wrong shape, expired — never
 * throws. Does *not* check the member's current pending-email/token
 * version; that requires a DB lookup and is the caller's job.
 */
export function parseEmailChangeToken(
  crypto: CryptoService,
  key: string,
): EmailChangeTokenPayload | null {
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

  if (!isEmailChangeTokenPayload(parsed)) {
    return null;
  }
  if (parsed.exp <= Date.now()) {
    return null;
  }
  return parsed;
}

function isEmailChangeTokenPayload(
  value: unknown,
): value is EmailChangeTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'email_change' &&
    typeof candidate.memberId === 'number' &&
    typeof candidate.newEmail === 'string' &&
    typeof candidate.version === 'number' &&
    typeof candidate.exp === 'number'
  );
}
