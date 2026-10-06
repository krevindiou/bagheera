import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  describe('in production', () => {
    const strong = {
      ...valid,
      NODE_ENV: 'production',
      SESSION_SECRET: 's'.repeat(32),
      CSRF_SECRET: 'c'.repeat(32),
      CRYPTO_KEYS: '{"1":"' + Buffer.alloc(32, 7).toString('base64') + '"}',
    };

    it('accepts strong secrets', () => {
      expect(() => validateEnv(strong)).not.toThrow();
    });

    it('rejects a session or CSRF secret under 32 bytes', () => {
      expect(() => validateEnv({ ...strong, SESSION_SECRET: 'short' })).toThrow(
        /SESSION_SECRET must be at least 32 bytes/,
      );
      expect(() => validateEnv({ ...strong, CSRF_SECRET: 'x'.repeat(31) })).toThrow(
        /CSRF_SECRET must be at least 32 bytes/,
      );
    });

    it('does not double-report a missing secret', () => {
      expect(() => validateEnv({ ...strong, SESSION_SECRET: undefined })).toThrow(
        /^Invalid environment configuration: SESSION_SECRET is required$/,
      );
    });

    it('rejects a published example CRYPTO_KEYS key', () => {
      expect(() =>
        validateEnv({
          ...strong,
          CRYPTO_KEYS: '{"1":"8mJ0e7Z3vscIKX6Sp4hzw1tCTQiSVF0gzOREHMhYTYM="}',
        }),
      ).toThrow(/CRYPTO_KEYS must not contain a published example key/);
    });

    it('rejects every secret shipped in .env.example, so the file can never go live', () => {
      const example = readFileSync(join(__dirname, '../../.env.example'), 'utf8');
      const read = (name: string) => new RegExp(`^${name}=(.*)$`, 'm').exec(example)?.[1] ?? '';
      const shipped = {
        ...strong,
        SESSION_SECRET: read('SESSION_SECRET'),
        CSRF_SECRET: read('CSRF_SECRET'),
        CRYPTO_KEYS: read('CRYPTO_KEYS'),
      };
      expect(() => validateEnv(shipped)).toThrow(/SESSION_SECRET.*CSRF_SECRET.*CRYPTO_KEYS/s);
    });

    it('leaves non-production environments alone', () => {
      expect(() => validateEnv({ ...valid, NODE_ENV: 'development' })).not.toThrow();
    });
  });
});
