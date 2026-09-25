import { validateEnv } from './env.validation';

const valid = {
  DATABASE_URL: 'postgres://x',
  VALKEY_URL: 'redis://x',
  CRYPTO_KEYS: '{}',
  CRYPTO_ACTIVE_KEY_ID: '1',
  SESSION_SECRET: 's',
  CSRF_SECRET: 'c',
  APP_URL: 'https://example.com',
  RP_ID: 'example.com',
  RP_NAME: 'Bagheera',
  RP_ORIGIN: 'https://example.com',
  EMAIL_SMTP_URL: 'smtp://x',
  EMAIL_FROM: 'a@example.com',
};

describe('validateEnv', () => {
  it('accepts a complete environment', () => {
    expect(validateEnv(valid)).toBe(valid);
  });

  it('lists every missing or blank required variable', () => {
    expect(() => validateEnv({ ...valid, RP_ID: undefined, RP_NAME: ' ' })).toThrow(
      /RP_ID is required; RP_NAME is required/,
    );
  });

  it('rejects a non-numeric session TTL', () => {
    expect(() => validateEnv({ ...valid, SESSION_IDLE_TTL_SECONDS: 'abc' })).toThrow(
      /SESSION_IDLE_TTL_SECONDS/,
    );
  });

  it('rejects an unknown time zone and accepts an IANA one', () => {
    expect(() => validateEnv({ ...valid, APP_TIMEZONE: 'Mars/Base' })).toThrow(/APP_TIMEZONE/);
    expect(() => validateEnv({ ...valid, APP_TIMEZONE: 'Europe/Paris' })).not.toThrow();
  });

  it('accepts a positive integer session TTL', () => {
    expect(() => validateEnv({ ...valid, SESSION_IDLE_TTL_SECONDS: '900' })).not.toThrow();
  });
});
