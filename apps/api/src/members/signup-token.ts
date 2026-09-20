import { Locale, SUPPORTED_LOCALES } from '../common/locale';
import { CryptoService } from '../security/crypto.service';

// Sign-up links expire after 1 hour. Unlike the old activation/reset tokens,
// there's no member row (and so no version counter) to bump on reissue —
// nothing exists yet when this token is minted. A resubmitted sign-up for
// the same email before the first link is used simply mints a second,
// independently-valid token; the short TTL is the only bound on that
// exposure (accepted trade-off — see docs/spec/01-user-registration.md).
// Replay/reuse protection instead comes from `member.email`'s unique index:
// a second completion attempt for the same email hits a unique-violation
// and collapses into the same generic error as every other failure mode.
const SIGNUP_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface SignupTokenPayload {
  type: 'signup';
  email: string;
  country: string;
  locale: Locale;
  /** Epoch milliseconds. */
  exp: number;
}

export function buildSignupToken(
  crypto: CryptoService,
  email: string,
  country: string,
  locale: Locale,
): string {
  const payload: SignupTokenPayload = {
    type: 'signup',
    email,
    country,
    locale,
    exp: Date.now() + SIGNUP_TOKEN_TTL_MS,
  };
  return crypto.encrypt(JSON.stringify(payload));
}

/**
 * Decrypts and validates the shape/expiry of a sign-up key. Returns `null`
 * for anything wrong with the token itself — tampered/malformed ciphertext,
 * bad JSON, wrong shape, expired — never throws, so callers can collapse
 * every such case into the same generic error path.
 */
export function parseSignupToken(crypto: CryptoService, key: string): SignupTokenPayload | null {
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

  if (!isSignupTokenPayload(parsed)) {
    return null;
  }
  if (parsed.exp <= Date.now()) {
    return null;
  }
  return parsed;
}

function isSignupTokenPayload(value: unknown): value is SignupTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    candidate.type === 'signup' &&
    typeof candidate.email === 'string' &&
    typeof candidate.country === 'string' &&
    typeof candidate.locale === 'string' &&
    (SUPPORTED_LOCALES as readonly string[]).includes(candidate.locale) &&
    typeof candidate.exp === 'number'
  );
}
