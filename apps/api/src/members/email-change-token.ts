import { CryptoService } from '../security/crypto.service';

// Short-lived: it proves control of the mailbox about to become the
// account's contact address.
const EMAIL_CHANGE_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface EmailChangeTokenPayload {
  type: 'email_change';
  /** The requesting member's stable id, not their (changeable) email. */
  memberId: string;
  newEmail: string;
  /** Must match `member.emailChangeTokenVersion`, which each new request
   * bumps, invalidating older links. */
  version: number;
  /** Epoch milliseconds. */
  exp: number;
}

export function buildEmailChangeToken(
  crypto: CryptoService,
  memberId: string,
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
 * Decrypts and checks shape/expiry; `null` for any bad token, never throws.
 * The pending-email/version check against the DB is the caller's job.
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

function isEmailChangeTokenPayload(value: unknown): value is EmailChangeTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'email_change' &&
    typeof candidate.memberId === 'string' &&
    typeof candidate.newEmail === 'string' &&
    typeof candidate.version === 'number' &&
    typeof candidate.exp === 'number'
  );
}
