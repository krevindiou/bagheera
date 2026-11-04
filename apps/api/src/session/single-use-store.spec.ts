import { vi } from 'vitest';
import { fakeRequest } from '../test-support/fake-http-context';
import { FakeValkey } from '../test-support/fake-valkey';
import { singleUseKey, SingleUseStore } from './single-use-store';

function setup() {
  const valkey = new FakeValkey();
  const store = new SingleUseStore(valkey.asClient());
  const req = fakeRequest({ sessionID: 'sid-1' });
  return { valkey, store, req };
}

describe('SingleUseStore', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns a stored value once, without its deadline', async () => {
    const { store, req } = setup();
    await store.put(req, 'stepUpProof', { memberId: 'm1' }, 1000);

    expect(await store.take(req, 'stepUpProof')).toEqual({ memberId: 'm1' });
    expect(await store.take(req, 'stepUpProof')).toBeUndefined();
  });

  it("stores each value under the session id and slot, with the value's lifetime as TTL", async () => {
    vi.useFakeTimers();
    const { valkey, store, req } = setup();
    await store.put(req, 'webauthnChallenge', { challenge: 'abc' }, 1000);

    expect(singleUseKey('sid-1', 'webauthnChallenge')).toBe('once:sid-1:webauthnChallenge');
    expect(await valkey.pttl('once:sid-1:webauthnChallenge')).toBe(1000);
  });

  it('removes the key when taken', async () => {
    const { valkey, store, req } = setup();
    await store.put(req, 'webauthnChallenge', { challenge: 'abc' }, 1000);

    await store.take(req, 'webauthnChallenge');

    expect(await valkey.get('once:sid-1:webauthnChallenge')).toBeNull();
  });

  it('refuses a value past its deadline even while its key lingers, and removes it', async () => {
    vi.useFakeTimers();
    const { valkey, store, req } = setup();
    const expiresAt = Date.now() - 1;
    await valkey.set(
      'once:sid-1:stepUpProof',
      JSON.stringify({ memberId: 'm1', expiresAt }),
      'PX',
      60_000,
    );

    expect(await store.take(req, 'stepUpProof')).toBeUndefined();
    expect(await valkey.get('once:sid-1:stepUpProof')).toBeNull();
  });

  it('accepts a value right at its deadline', async () => {
    vi.useFakeTimers();
    const { valkey, store, req } = setup();
    await valkey.set(
      'once:sid-1:stepUpProof',
      JSON.stringify({ memberId: 'm1', expiresAt: Date.now() }),
      'PX',
      60_000,
    );

    expect(await store.take(req, 'stepUpProof')).toEqual({ memberId: 'm1' });
  });

  it("never hands one session's value to another", async () => {
    const { store, req } = setup();
    await store.put(req, 'stepUpProof', { memberId: 'm1' }, 1000);

    const other = fakeRequest({ sessionID: 'sid-2' });
    expect(await store.take(other, 'stepUpProof')).toBeUndefined();
    expect(await store.take(req, 'stepUpProof')).toEqual({ memberId: 'm1' });
  });

  it('replaces an unspent value', async () => {
    const { store, req } = setup();
    await store.put(req, 'registrationChallenge', { challenge: 'first' }, 1000);
    await store.put(req, 'registrationChallenge', { challenge: 'second' }, 1000);

    expect(await store.take(req, 'registrationChallenge')).toEqual({ challenge: 'second' });
  });
});
