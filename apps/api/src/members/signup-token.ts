import { isValidTimeZone } from '../common/local-date';
import { Locale, SUPPORTED_LOCALES } from '../common/locale';
import { CryptoService } from '../security/crypto.service';

// No member row exists yet, so no version counter: a resubmitted sign-up
// mints a second valid token, bounded only by this TTL. Replay is stopped
// by `member.email`'s unique index instead.
const SIGNUP_TOKEN_TTL_MS = 60 * 60 * 1000;

export interface SignupTokenPayload {
  type: 'signup';
  email: string;
  country: string;
  locale: Locale;
  /** Absent when the registering browser sent none. */
  timeZone?: string;
  /** Epoch milliseconds. */
  exp: number;
}

export function buildSignupToken(
  crypto: CryptoService,
  email: string,
  country: string,
  locale: Locale,
  timeZone?: string,
): string {
  const payload: SignupTokenPayload = {
    type: 'signup',
    email,
    country,
    locale,
    timeZone,
    exp: Date.now() + SIGNUP_TOKEN_TTL_MS,
  };
  return crypto.encrypt(JSON.stringify(payload));
}

/** Decrypts and checks shape/expiry; `null` for any bad token, never throws. */
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
    (candidate.timeZone === undefined || isValidTimeZone(candidate.timeZone)) &&
    typeof candidate.exp === 'number'
  );
}
