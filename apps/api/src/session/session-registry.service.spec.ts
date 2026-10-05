import type IORedis from 'ioredis';
import { vi } from 'vitest';
import { SessionRegistryService } from './session-registry.service';

function fakeValkey(members: string[] = []) {
  const chain = {
    sadd: vi.fn().mockReturnThis(),
    expire: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    srem: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };
  const client = {
    multi: vi.fn().mockReturnValue(chain),
    smembers: vi.fn().mockResolvedValue(members),
    srem: vi.fn().mockResolvedValue(1),
  };
  return { chain, client, service: new SessionRegistryService(client as unknown as IORedis) };
}

describe('SessionRegistryService', () => {
  it('adds the session to the member set and caps the set at the absolute session lifetime', async () => {
    const { chain, service } = fakeValkey();
    await service.register('m1', 's1');
    expect(chain.sadd).toHaveBeenCalledWith('member:m1:sessions', 's1');
    expect(chain.expire).toHaveBeenCalledWith('member:m1:sessions', 24 * 60 * 60);
    expect(chain.exec).toHaveBeenCalled();
  });

  it('removes one session from the member set', async () => {
    const { client, service } = fakeValkey();
    await service.unregister('m1', 's1');
    expect(client.srem).toHaveBeenCalledWith('member:m1:sessions', 's1');
  });

  it('deletes every session but the kept one, and drops them from the set', async () => {
    const { chain, service } = fakeValkey(['s1', 's2', 's3']);
    await service.revokeOthers('m1', 's2');
    expect(chain.del).toHaveBeenCalledWith('sess:s1', 'sess:s3');
    expect(chain.srem).toHaveBeenCalledWith('member:m1:sessions', 's1', 's3');
  });

  it('deletes all sessions when none is kept', async () => {
    const { chain, service } = fakeValkey(['s1']);
    await service.revokeOthers('m1');
    expect(chain.del).toHaveBeenCalledWith('sess:s1');
  });

  it('does nothing when the member has no other session', async () => {
    const { client, service } = fakeValkey(['s2']);
    await service.revokeOthers('m1', 's2');
    expect(client.multi).not.toHaveBeenCalled();
  });
});
