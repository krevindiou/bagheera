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

export function validateEnv(env: Record<string, unknown>): Record<string, unknown> {
  const problems: string[] = [];

  for (const key of REQUIRED) {
    const value = env[key];
    if (typeof value !== 'string' || value.trim() === '') {
      problems.push(`${key} is required`);
    }
  }

  const ttl = env.SESSION_IDLE_TTL_SECONDS;
  if (ttl !== undefined && ttl !== '') {
    const parsed = Number(ttl);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      problems.push('SESSION_IDLE_TTL_SECONDS must be a positive integer');
    }
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration: ${problems.join('; ')}`);
  }
  return env;
}
