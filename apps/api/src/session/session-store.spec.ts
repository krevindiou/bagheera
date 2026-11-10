import type { SessionData } from 'express-session';
import type IORedis from 'ioredis';
import { vi } from 'vitest';
import {
  ANONYMOUS_SESSION_MAX_AGE_MS,
  SESSION_IDLE_TTL_SECONDS,
  SESSION_MAX_AGE_MS,
} from './session.constants';
import { SessionStore, sessionMaxAgeMs, sessionTtlSeconds } from './session-store';

const NOW = 1_800_000_000_000;

function sessionOf(fields: Partial<SessionData>): SessionData {
  return { cookie: {}, ...fields } as SessionData;
}

describe('sessionMaxAgeMs', () => {
  it('caps a signed-in session at 8h and an anonymous one at an idle timeout', () => {
    expect(sessionMaxAgeMs({ memberId: 'm' })).toBe(SESSION_MAX_AGE_MS);
    expect(sessionMaxAgeMs({ csrfIssued: true })).toBe(ANONYMOUS_SESSION_MAX_AGE_MS);
    expect(ANONYMOUS_SESSION_MAX_AGE_MS).toBe(SESSION_IDLE_TTL_SECONDS * 1000);
  });
});

describe('sessionTtlSeconds', () => {
  it('gives a signed-in session the full idle timeout, however old', () => {
    const createdAt = NOW - SESSION_MAX_AGE_MS + 1000;
    expect(sessionTtlSeconds({ memberId: 'm', createdAt }, NOW)).toBe(SESSION_IDLE_TTL_SECONDS);
  });

  it('gives an anonymous session just stored the full idle timeout', () => {
    expect(sessionTtlSeconds({ createdAt: NOW }, NOW)).toBe(SESSION_IDLE_TTL_SECONDS);
    expect(sessionTtlSeconds({}, NOW)).toBe(SESSION_IDLE_TTL_SECONDS);
  });

  // A refresh must not push its key past the cap.
  it("holds an anonymous session to what's left of its cap", () => {
    const createdAt = NOW - ANONYMOUS_SESSION_MAX_AGE_MS + 90_500;
    expect(sessionTtlSeconds({ createdAt }, NOW)).toBe(90);
  });

  it('is 0 or less once an anonymous session is past its cap, which deletes the key', () => {
    expect(sessionTtlSeconds({ createdAt: NOW - ANONYMOUS_SESSION_MAX_AGE_MS }, NOW)).toBe(0);
    expect(
      sessionTtlSeconds({ createdAt: NOW - ANONYMOUS_SESSION_MAX_AGE_MS - 5000 }, NOW),
    ).toBeLessThan(0);
  });
});

describe('SessionStore', () => {
  function fakeClient() {
    return {
      set: vi.fn().mockResolvedValue('OK'),
      expire: vi.fn().mockResolvedValue(1),
      del: vi.fn().mockResolvedValue(1),
    };
  }

  function storeWith(client: ReturnType<typeof fakeClient>): SessionStore {
    return new SessionStore(client as unknown as IORedis);
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stamps createdAt on first save and stores it with the TTL it computes', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const client = fakeClient();
    const session = sessionOf({ csrfIssued: true });

    await storeWith(client).set('sid', session);

    expect(session.createdAt).toBe(NOW);
    expect(client.set).toHaveBeenCalledWith(
      'sess:sid',
      JSON.stringify(session),
      'EX',
      SESSION_IDLE_TTL_SECONDS,
    );
  });

  it('keeps an existing createdAt', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const client = fakeClient();
    const session = sessionOf({ csrfIssued: true, createdAt: NOW - 60_000 });

    await storeWith(client).set('sid', session);

    expect(session.createdAt).toBe(NOW - 60_000);
    expect(client.set).toHaveBeenCalledWith(
      'sess:sid',
      expect.any(String),
      'EX',
      SESSION_IDLE_TTL_SECONDS - 60,
    );
  });

  it('refreshes an anonymous session no further than its cap', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const client = fakeClient();
    const createdAt = NOW - ANONYMOUS_SESSION_MAX_AGE_MS + 30_000;

    await storeWith(client).touch('sid', sessionOf({ csrfIssued: true, createdAt }));

    expect(client.expire).toHaveBeenCalledWith('sess:sid', 30);
  });

  it('refreshes a signed-in session for a full idle timeout', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const client = fakeClient();
    const createdAt = NOW - 2 * ANONYMOUS_SESSION_MAX_AGE_MS;

    await storeWith(client).touch('sid', sessionOf({ memberId: 'm', createdAt }));

    expect(client.expire).toHaveBeenCalledWith('sess:sid', SESSION_IDLE_TTL_SECONDS);
  });

  it('deletes an anonymous session saved past its cap instead of storing it', async () => {
    vi.useFakeTimers({ now: NOW, toFake: ['Date'] });
    const client = fakeClient();
    const createdAt = NOW - ANONYMOUS_SESSION_MAX_AGE_MS - 1000;

    await storeWith(client).set('sid', sessionOf({ csrfIssued: true, createdAt }));

    expect(client.set).not.toHaveBeenCalled();
    expect(client.del).toHaveBeenCalledWith('sess:sid');
  });

  // What express-session saves after a regenerate nothing wrote to.
  it('deletes a session holding nothing but its cookie instead of storing it', async () => {
    const client = fakeClient();
    const session = sessionOf({});

    await storeWith(client).set('sid', session);

    expect(client.set).not.toHaveBeenCalled();
    expect(client.del).toHaveBeenCalledWith('sess:sid');
    expect(session.createdAt).toBeUndefined();
  });
});
