import { Logger } from '@nestjs/common';
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
  const pipeline = {
    get: vi.fn().mockReturnThis(),
    pttl: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue([]),
  };
  const client = {
    multi: vi.fn().mockReturnValue(chain),
    pipeline: vi.fn().mockReturnValue(pipeline),
    smembers: vi.fn().mockResolvedValue(members),
    srem: vi.fn().mockResolvedValue(1),
    sismember: vi.fn().mockResolvedValue(0),
  };
  return {
    chain,
    client,
    pipeline,
    service: new SessionRegistryService(client as unknown as IORedis),
  };
}

describe('SessionRegistryService', () => {
  it('adds the session to the member set and caps the set at the absolute session lifetime', async () => {
    const { chain, service } = fakeValkey();
    await service.register('m1', 's1');
    expect(chain.sadd).toHaveBeenCalledWith('member:m1:sessions', 's1');
    expect(chain.expire).toHaveBeenCalledWith('member:m1:sessions', 8 * 60 * 60);
    expect(chain.exec).toHaveBeenCalled();
  });

  it('removes one session from the member set', async () => {
    const { client, service } = fakeValkey();
    await service.unregister('m1', 's1');
    expect(client.srem).toHaveBeenCalledWith('member:m1:sessions', 's1');
  });

  it('reports a session listed in the member set as registered', async () => {
    const { client, service } = fakeValkey();
    client.sismember.mockResolvedValue(1);
    await expect(service.isRegistered('m1', 's1')).resolves.toBe(true);
    expect(client.sismember).toHaveBeenCalledWith('member:m1:sessions', 's1');
  });

  it('reports a session missing from the member set as not registered', async () => {
    const { service } = fakeValkey();
    await expect(service.isRegistered('m1', 's1')).resolves.toBe(false);
  });

  it('reads every listed session with its remaining TTL, skipping ended and unreadable ones', async () => {
    const { pipeline, service } = fakeValkey(['s1', 's2', 's3', 's4']);
    pipeline.exec.mockResolvedValue([
      [null, JSON.stringify({ memberId: 'm1' })],
      [null, 60_000],
      [null, null],
      [null, -2],
      [null, '{not json'],
      [null, 1000],
      [new Error('boom'), null],
      [null, 1000],
    ]);

    await expect(service.sessionsOf('m1')).resolves.toEqual([
      { id: 's1', data: { memberId: 'm1' }, ttlMs: 60_000 },
    ]);
    expect(pipeline.get).toHaveBeenCalledWith('sess:s1');
    expect(pipeline.pttl).toHaveBeenCalledWith('sess:s1');
  });

  it('reads nothing when the member has no listed session', async () => {
    const { client, service } = fakeValkey();
    await expect(service.sessionsOf('m1')).resolves.toEqual([]);
    expect(client.pipeline).not.toHaveBeenCalled();
  });

  it('deletes one session and drops it from the set', async () => {
    const { chain, service } = fakeValkey();
    await service.revoke('m1', 's2');
    expect(chain.del).toHaveBeenCalledWith('sess:s2');
    expect(chain.srem).toHaveBeenCalledWith('member:m1:sessions', 's2');
    expect(chain.exec).toHaveBeenCalled();
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

  it('revokes like revokeOthers when trying', async () => {
    const { chain, service } = fakeValkey(['s1', 's2']);
    await service.tryRevokeOthers('m1', 's2');
    expect(chain.del).toHaveBeenCalledWith('sess:s1');
  });

  it('logs instead of throwing when Valkey fails while trying', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const { client, service } = fakeValkey();
    client.smembers.mockRejectedValue(new Error('Connection is closed.'));
    await expect(service.tryRevokeOthers('m1', 's2')).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      'Other sessions not removed from the store: Connection is closed.',
    );
    warn.mockRestore();
  });
});
