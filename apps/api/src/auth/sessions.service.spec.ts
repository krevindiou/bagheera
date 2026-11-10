import { NotFoundException } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { vi } from 'vitest';
import type { AuditService } from '../security/audit.service';
import type { SessionRegistryService, StoredSession } from '../session/session-registry.service';
import { SESSION_IDLE_TTL_SECONDS, SESSION_MAX_AGE_MS } from '../session/session.constants';
import type { SingleUseStore } from '../session/single-use-store';
import { SessionsService } from './sessions.service';

const NOW = Date.UTC(2026, 10, 10, 12);
const MINUTE = 60_000;

function stored(id: string, data: StoredSession['data'], idleMs = 0): StoredSession {
  return {
    id,
    data: { memberId: 'm1', createdAt: NOW - 60 * MINUTE, ...data },
    ttlMs: SESSION_IDLE_TTL_SECONDS * 1000 - idleMs,
  };
}

function setup(sessions: StoredSession[], sessionEpoch = 0) {
  const db = {
    select: () => ({ from: () => ({ where: () => Promise.resolve([{ sessionEpoch }]) }) }),
  };
  const registry = {
    sessionsOf: vi.fn().mockResolvedValue(sessions),
    revoke: vi.fn().mockResolvedValue(undefined),
    revokeOthers: vi.fn().mockResolvedValue(undefined),
  };
  const singleUse = { take: vi.fn().mockResolvedValue({ memberId: 'm1' }) };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const service = new SessionsService(
    db as unknown as NodePgDatabase,
    registry as unknown as SessionRegistryService,
    singleUse as unknown as SingleUseStore,
    audit as unknown as AuditService,
  );
  const req = { session: { memberId: 'm1' }, sessionID: 'current', ip: '198.51.100.1' } as Request;
  return { service, registry, audit, req };
}

describe('SessionsService', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('list', () => {
    it('puts the current session first, then the most recently active', async () => {
      const { service, req } = setup([
        stored('stale', {}, 20 * MINUTE),
        stored('current', {}, 5 * MINUTE),
        stored('fresh', {}, 2 * MINUTE),
      ]);

      const sessions = await service.list(req);

      expect(sessions.map((session) => session.current)).toEqual([true, false, false]);
      expect(sessions[0].lastActiveAt).toEqual(new Date(NOW));
      expect(sessions[1].lastActiveAt).toEqual(new Date(NOW - 2 * MINUTE));
      expect(sessions[2].lastActiveAt).toEqual(new Date(NOW - 20 * MINUTE));
    });

    it('describes the browser it signed in from, and falls back to createdAt without that record', async () => {
      const { service, req } = setup([
        stored('a', {
          client: {
            userAgent: 'Firefox/132.0 (X11; Linux)',
            ip: '203.0.113.7',
            signedInAt: NOW - MINUTE,
          },
        }),
        stored('b', {}),
      ]);

      const [a, b] = await service.list(req);

      expect(a).toMatchObject({
        browser: 'Firefox',
        os: 'Linux',
        ipAddress: '203.0.113.7',
        lastIpAddress: '203.0.113.7',
        signedInAt: new Date(NOW - MINUTE),
      });
      expect(b).toMatchObject({
        browser: null,
        os: null,
        ipAddress: null,
        lastIpAddress: null,
        signedInAt: new Date(NOW - 60 * MINUTE),
      });
    });

    it("lists another session's latest network, and this one's own request address", async () => {
      const client = { userAgent: null, ip: '203.0.113.7', signedInAt: NOW - MINUTE };
      const { service, req } = setup([
        stored('current', { client }),
        stored('moved', { client: { ...client, lastIp: '192.0.2.40' } }),
      ]);

      const [current, moved] = await service.list(req);

      expect(current).toMatchObject({ ipAddress: '203.0.113.7', lastIpAddress: '198.51.100.1' });
      expect(moved).toMatchObject({ ipAddress: '203.0.113.7', lastIpAddress: '192.0.2.40' });
    });

    it('leaves out sessions of another member, of an older epoch, or past the absolute cap', async () => {
      const { service, req } = setup(
        [
          stored('live', { sessionEpoch: 2 }),
          stored('foreign', { memberId: 'm2', sessionEpoch: 2 }),
          stored('ended', { sessionEpoch: 1 }),
          stored('expired', { sessionEpoch: 2, createdAt: NOW - SESSION_MAX_AGE_MS - 1 }),
        ],
        2,
      );

      expect(await service.list(req)).toHaveLength(1);
    });

    it('never hands out the session id', async () => {
      const { service, req } = setup([stored('secret-session-id', {})]);

      const [session] = await service.list(req);

      expect(session.id).toMatch(/^[0-9a-f]{32}$/);
      expect(session.id).not.toContain('secret-session-id');
    });
  });

  describe('revoke', () => {
    it('revokes the session the handle names', async () => {
      const { service, registry, audit, req } = setup([stored('current', {}), stored('other', {})]);
      const other = (await service.list(req)).find((session) => !session.current);

      await service.revoke(req, other!.id);

      expect(registry.revoke).toHaveBeenCalledWith('m1', 'other');
      expect(audit.record).toHaveBeenCalledWith('session_revoked', 'm1', '198.51.100.1');
    });

    it('refuses the current session, which signs out instead', async () => {
      const { service, registry, req } = setup([stored('current', {})]);
      const [current] = await service.list(req);

      await expect(service.revoke(req, current.id)).rejects.toBeInstanceOf(NotFoundException);
      expect(registry.revoke).not.toHaveBeenCalled();
    });
  });

  it('revokes every other session, keeping the current one', async () => {
    const { service, registry, audit, req } = setup([]);

    await service.revokeOthers(req);

    expect(registry.revokeOthers).toHaveBeenCalledWith('m1', 'current');
    expect(audit.record).toHaveBeenCalledWith('other_sessions_revoked', 'm1', '198.51.100.1');
  });
});
