import type { Session, SessionData } from 'express-session';
import { vi } from 'vitest';
import { CHALLENGE_TTL_MS, storeChallenge, takeChallenge } from './challenge';

function session(data: Partial<SessionData> = {}): Session & Partial<SessionData> {
  return data as Session & Partial<SessionData>;
}

describe('challenge', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a stored challenge while it is fresh, once', () => {
    const s = session();
    storeChallenge(s, 'registrationChallenge', 'abc');

    expect(takeChallenge(s, 'registrationChallenge')).toBe('abc');
    expect(takeChallenge(s, 'registrationChallenge')).toBeUndefined();
  });

  it.each(['webauthnChallenge', 'registrationChallenge', 'stepUpChallenge'] as const)(
    'expires the %s challenge after the TTL and clears it',
    (key) => {
      vi.useFakeTimers();
      const s = session();
      storeChallenge(s, key, 'abc');

      vi.advanceTimersByTime(CHALLENGE_TTL_MS + 1);

      expect(takeChallenge(s, key)).toBeUndefined();
      expect(s[key]).toBeUndefined();
      expect(s[`${key}IssuedAt`]).toBeUndefined();
    },
  );

  it('still accepts a challenge right at the TTL', () => {
    vi.useFakeTimers();
    const s = session();
    storeChallenge(s, 'stepUpChallenge', 'abc');

    vi.advanceTimersByTime(CHALLENGE_TTL_MS);

    expect(takeChallenge(s, 'stepUpChallenge')).toBe('abc');
  });

  it('treats a challenge with no timestamp as expired', () => {
    const s = session({ webauthnChallenge: 'abc' });
    expect(takeChallenge(s, 'webauthnChallenge')).toBeUndefined();
    expect(s.webauthnChallenge).toBeUndefined();
  });

  it('returns undefined when nothing is pending', () => {
    expect(takeChallenge(session(), 'webauthnChallenge')).toBeUndefined();
  });

  it('keeps the three ceremonies separate', () => {
    const s = session();
    storeChallenge(s, 'webauthnChallenge', 'sign-in');

    expect(takeChallenge(s, 'registrationChallenge')).toBeUndefined();
    expect(takeChallenge(s, 'webauthnChallenge')).toBe('sign-in');
  });
});
