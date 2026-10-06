import { isValidTimeZone } from '../common/local-date';

const REQUIRED = [
  'DATABASE_URL',
  'VALKEY_URL',
  'CRYPTO_KEYS',
  'CRYPTO_ACTIVE_KEY_ID',
  'SESSION_SECRET',
  'CSRF_SECRET',
  'APP_URL',
  'RP_ID',
  'RP_NAME',
  'RP_ORIGIN',
  'EMAIL_SMTP_URL',
  'EMAIL_FROM',
] as const;

// Production-only floor: the session/CSRF secrets key HMACs, so a short one
// is brute-forceable offline.
const MIN_SECRET_BYTES = 32;

// Values that ship in the repo — the example env file, the CI test env
// (.github/actions/write-api-test-env), git history — and so are public.
// The dev stack boots with them; production must not.
const PUBLISHED_SECRETS = new Set([
  'dev-session-secret-change-me',
  'dev-csrf-secret-change-me',
  'A8IGSXBmWg58OWNxIXm7f846RROEq8S0SZFJDGU/grQ=',
  '8mJ0e7Z3vscIKX6Sp4hzw1tCTQiSVF0gzOREHMhYTYM=',
]);

function checkProductionSecrets(env: Record<string, unknown>, problems: string[]): void {
  for (const key of ['SESSION_SECRET', 'CSRF_SECRET'] as const) {
    const value = env[key];
    if (typeof value !== 'string' || value.trim() === '') continue; // already reported
    if (Buffer.byteLength(value) < MIN_SECRET_BYTES) {
      problems.push(`${key} must be at least ${MIN_SECRET_BYTES} bytes in production`);
    }
    if (PUBLISHED_SECRETS.has(value)) {
      problems.push(`${key} must not be a published example value in production`);
    }
  }

  const cryptoKeys = env.CRYPTO_KEYS;
  if (typeof cryptoKeys !== 'string') return;
  try {
    const parsed = JSON.parse(cryptoKeys) as Record<string, unknown>;
    if (Object.values(parsed).some((v) => typeof v === 'string' && PUBLISHED_SECRETS.has(v))) {
      problems.push('CRYPTO_KEYS must not contain a published example key in production');
    }
  } catch {
    // Malformed JSON is CryptoService's to report at boot.
  }
}

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const problems: string[] = [];

  for (const key of REQUIRED) {
    const value = env[key];
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${key} is required`);
    }
  }

  if (env.NODE_ENV === 'production') {
    checkProductionSecrets(env, problems);
  }

  const ttl = env.SESSION_IDLE_TTL_SECONDS;
  if (ttl !== undefined && ttl !== '') {
    const parsed = Number(ttl);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      problems.push('SESSION_IDLE_TTL_SECONDS must be a positive integer');
    }
  }

  const timeZone = env.APP_TIMEZONE;
  if (typeof timeZone === 'string' && timeZone !== '' && !isValidTimeZone(timeZone)) {
    problems.push('APP_TIMEZONE must be a valid IANA time zone');
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration: ${problems.join('; ')}`);
  }
  return env;
}
