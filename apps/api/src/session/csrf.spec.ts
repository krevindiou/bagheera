import { ConfigService } from '@nestjs/config';
import { doubleCsrf, DoubleCsrfConfigOptions } from 'csrf-csrf';
import { buildCsrf } from './csrf';

// buildCsrf's own job is the config object it hands to doubleCsrf() — the
// token-generation/cookie machinery on the other side of that call is
// csrf-csrf's own tested concern. Spying on the real doubleCsrf (rather
// than faking a whole Express request/response/cookie-parser stack) tests
// exactly that boundary. jest.requireActual is untyped (returns `any`) —
// the eslint-disable below is that, and only that.
/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
jest.mock('csrf-csrf', () => {
  const actual = jest.requireActual('csrf-csrf');
  return { ...actual, doubleCsrf: jest.fn(actual.doubleCsrf) };
});
/* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */

// Cast once, here, to the real call signature — every later `.mock.calls`
// read stays properly typed instead of leaking `any`.
const mockedDoubleCsrf = doubleCsrf as jest.Mock<
  ReturnType<typeof doubleCsrf>,
  [DoubleCsrfConfigOptions]
>;

function lastConfigOptions(): DoubleCsrfConfigOptions {
  const calls = mockedDoubleCsrf.mock.calls;
  return calls[calls.length - 1][0];
}

// A plain shape, not typed as ConfigService — extracting `.getOrThrow` off
// a value typed as the real class trips @typescript-eslint/unbound-method
// (a false positive for jest's expect(fn).toHaveBeenCalledWith(...)).
function fakeConfig(getOrThrow: jest.Mock) {
  return { getOrThrow };
}

describe('buildCsrf', () => {
  it('wires the expected cookie name and options', () => {
    const config = fakeConfig(jest.fn().mockReturnValue('a-csrf-secret'));
    buildCsrf(config as unknown as ConfigService);
    expect(lastConfigOptions()).toMatchObject({
      cookieName: 'bagheera.csrf',
      cookieOptions: {
        sameSite: 'lax',
        secure: true,
        httpOnly: true,
        path: '/',
      },
    });
  });

  it('reads CSRF_SECRET lazily through getOrThrow — not at buildCsrf() call time', () => {
    const getOrThrow = jest.fn(() => {
      throw new Error('CSRF_SECRET not set');
    });
    const config = fakeConfig(getOrThrow);
    expect(() => buildCsrf(config as unknown as ConfigService)).not.toThrow();
    const { getSecret } = lastConfigOptions();
    expect(() => getSecret()).toThrow('CSRF_SECRET not set');
    expect(getOrThrow).toHaveBeenCalledWith('CSRF_SECRET');
  });

  it('reads the session id via getSessionIdentifier', () => {
    const config = fakeConfig(jest.fn().mockReturnValue('a-csrf-secret'));
    buildCsrf(config as unknown as ConfigService);
    const { getSessionIdentifier } = lastConfigOptions();
    expect(getSessionIdentifier({ session: { id: 'sess-1' } } as never)).toBe(
      'sess-1',
    );
  });

  it('returns the DoubleCsrfUtilities surface every caller relies on', () => {
    const config = fakeConfig(jest.fn().mockReturnValue('a-csrf-secret'));
    const csrf = buildCsrf(config as unknown as ConfigService);
    expect(csrf).toHaveProperty('doubleCsrfProtection');
    expect(csrf).toHaveProperty('generateCsrfToken');
  });
});
