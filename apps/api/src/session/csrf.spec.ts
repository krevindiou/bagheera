import { ConfigService } from '@nestjs/config';
import { doubleCsrf, DoubleCsrfConfigOptions } from 'csrf-csrf';
import { vi, type Mock } from 'vitest';
import { buildCsrf } from './csrf';

// buildCsrf's job is the config it hands doubleCsrf(); the rest is
// csrf-csrf's.
vi.mock('csrf-csrf', async () => {
  const actual = await vi.importActual<typeof import('csrf-csrf')>('csrf-csrf');
  return { ...actual, doubleCsrf: vi.fn(actual.doubleCsrf) };
});

const mockedDoubleCsrf = vi.mocked(doubleCsrf);

function lastConfigOptions(): DoubleCsrfConfigOptions {
  const calls = mockedDoubleCsrf.mock.calls;
  return calls[calls.length - 1][0];
}

// Not typed as ConfigService, which would trip
// @typescript-eslint/unbound-method on `.getOrThrow` assertions.
function fakeConfig(getOrThrow: Mock) {
  return { getOrThrow };
}

describe('buildCsrf', () => {
  it('wires the expected cookie name and options', () => {
    const config = fakeConfig(vi.fn().mockReturnValue('a-csrf-secret'));
    buildCsrf(config as unknown as ConfigService);
    expect(lastConfigOptions()).toMatchObject({
      cookieName: '__Host-bagheera.csrf',
      cookieOptions: {
        sameSite: 'strict',
        secure: true,
        httpOnly: true,
        path: '/',
      },
    });
  });

  it('reads CSRF_SECRET lazily through getOrThrow — not at buildCsrf() call time', () => {
    const getOrThrow = vi.fn(() => {
      throw new Error('CSRF_SECRET not set');
    });
    const config = fakeConfig(getOrThrow);
    expect(() => buildCsrf(config as unknown as ConfigService)).not.toThrow();
    const { getSecret } = lastConfigOptions();
    expect(() => getSecret()).toThrow('CSRF_SECRET not set');
    expect(getOrThrow).toHaveBeenCalledWith('CSRF_SECRET');
  });

  it('reads the session id via getSessionIdentifier', () => {
    const config = fakeConfig(vi.fn().mockReturnValue('a-csrf-secret'));
    buildCsrf(config as unknown as ConfigService);
    const { getSessionIdentifier } = lastConfigOptions();
    expect(getSessionIdentifier({ session: { id: 'sess-1' } } as never)).toBe('sess-1');
  });

  it('returns the DoubleCsrfUtilities surface every caller relies on', () => {
    const config = fakeConfig(vi.fn().mockReturnValue('a-csrf-secret'));
    const csrf = buildCsrf(config as unknown as ConfigService);
    expect(csrf).toHaveProperty('doubleCsrfProtection');
    expect(csrf).toHaveProperty('generateCsrfToken');
  });
});
