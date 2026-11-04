import { vi } from 'vitest';
import { fakeRequest } from '../test-support/fake-http-context';
import { FakeValkey } from '../test-support/fake-valkey';
import { CHALLENGE_TTL_MS, storeChallenge, takeChallenge } from './challenge';
import { SingleUseStore } from './single-use-store';

function setup() {
  const store = new SingleUseStore(new FakeValkey().asClient());
  const req = fakeRequest({ sessionID: 'sid-1' });
  return { store, req };
}

describe('challenge', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a stored challenge while it is fresh, once', async () => {
    const { store, req } = setup();
    await storeChallenge(store, req, 'registrationChallenge', { challenge: 'abc' });

    expect(await takeChallenge(store, req, 'registrationChallenge')).toEqual({ challenge: 'abc' });
    expect(await takeChallenge(store, req, 'registrationChallenge')).toBeUndefined();
  });

  it('keeps what a ceremony binds to its challenge', async () => {
    const { store, req } = setup();
    await storeChallenge(store, req, 'pendingSignupChallenge', {
      challenge: 'abc',
      signupKey: 'key',
    });

    expect(await takeChallenge(store, req, 'pendingSignupChallenge')).toEqual({
      challenge: 'abc',
      signupKey: 'key',
    });
  });

  it.each(['webauthnChallenge', 'registrationChallenge', 'pendingSignupChallenge'] as const)(
    'expires the %s challenge after the TTL',
    async (key) => {
      vi.useFakeTimers();
      const { store, req } = setup();
      await storeChallenge(store, req, key, { challenge: 'abc', signupKey: 'key' });

      vi.advanceTimersByTime(CHALLENGE_TTL_MS + 1);

      expect(await takeChallenge(store, req, key)).toBeUndefined();
    },
  );

  it('still accepts a challenge just before the TTL', async () => {
    vi.useFakeTimers();
    const { store, req } = setup();
    await storeChallenge(store, req, 'stepUpChallenge', { challenge: 'abc', memberId: 'm1' });

    vi.advanceTimersByTime(CHALLENGE_TTL_MS - 1);

    expect(await takeChallenge(store, req, 'stepUpChallenge')).toEqual({
      challenge: 'abc',
      memberId: 'm1',
    });
  });

  it('returns undefined when nothing is pending', async () => {
    const { store, req } = setup();
    expect(await takeChallenge(store, req, 'webauthnChallenge')).toBeUndefined();
  });

  it('keeps the ceremonies separate', async () => {
    const { store, req } = setup();
    await storeChallenge(store, req, 'webauthnChallenge', { challenge: 'sign-in' });

    expect(await takeChallenge(store, req, 'registrationChallenge')).toBeUndefined();
    expect(await takeChallenge(store, req, 'pendingSignupChallenge')).toBeUndefined();
    expect(await takeChallenge(store, req, 'webauthnChallenge')).toEqual({ challenge: 'sign-in' });
  });
});
