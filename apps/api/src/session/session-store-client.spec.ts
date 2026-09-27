import type IORedis from 'ioredis';
import { sessionStoreClient } from './session-store-client';
import { vi } from 'vitest';

function fakeClient() {
  return {
    get: vi.fn().mockResolvedValue('v'),
    set: vi.fn().mockResolvedValue('OK'),
    expire: vi.fn().mockResolvedValue(1),
    del: vi.fn().mockResolvedValue(2),
    mget: vi.fn().mockResolvedValue(['a', null]),
    scanStream: vi.fn().mockReturnValue('stream'),
  };
}

describe('sessionStoreClient', () => {
  it('translates node-redis calls to ioredis ones', async () => {
    const fake = fakeClient();
    const client = sessionStoreClient(fake as unknown as IORedis);

    await expect(client.get('k')).resolves.toBe('v');
    await client.set('k', 'v', { expiration: { type: 'EX', value: 60 } });
    expect(fake.set).toHaveBeenLastCalledWith('k', 'v', 'EX', 60);
    await client.set('k', 'v');
    expect(fake.set).toHaveBeenLastCalledWith('k', 'v');
    await client.expire('k', 30);
    expect(fake.expire).toHaveBeenCalledWith('k', 30);
    await expect(client.del(['a', 'b'])).resolves.toBe(2);
    expect(fake.del).toHaveBeenCalledWith('a', 'b');
    await expect(client.mGet(['a', 'b'])).resolves.toEqual(['a', null]);
    expect(fake.mget).toHaveBeenCalledWith('a', 'b');
    expect(client.scanIterator({ MATCH: 'sess:*', COUNT: 100 })).toBe('stream');
    expect(fake.scanStream).toHaveBeenCalledWith({ match: 'sess:*', count: 100 });
  });

  it('skips DEL for an empty key list (ioredis rejects it)', async () => {
    const fake = fakeClient();
    await expect(sessionStoreClient(fake as unknown as IORedis).del([])).resolves.toBe(0);
    expect(fake.del).not.toHaveBeenCalled();
  });
});
