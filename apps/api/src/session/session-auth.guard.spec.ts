import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SessionAuthGuard } from './session-auth.guard';
import type { SessionClient } from './session-data';
import type { SessionRegistryService } from './session-registry.service';
import type { AuditService } from '../security/audit.service';
import { fakeExecutionContext, fakeRequest } from '../test-support/fake-http-context';
import { vi } from 'vitest';

function fakeReflector(isPublic: boolean | undefined): Reflector {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
}

// `rows` is what the member's epoch lookup returns.
function fakeDb(rows: { sessionEpoch: number }[]) {
  const where = vi.fn().mockResolvedValue(rows);
  const select = vi.fn(() => ({ from: () => ({ where }) }));
  return { db: { select } as unknown as NodePgDatabase, select };
}

function setup(
  isPublic: boolean | undefined,
  registered = true,
  rows: { sessionEpoch: number }[] = [{ sessionEpoch: 0 }],
) {
  const registry = {
    isRegistered: vi.fn().mockResolvedValue(registered),
    revoke: vi.fn().mockResolvedValue(undefined),
  };
  const audit = { record: vi.fn().mockResolvedValue(undefined) };
  const { db, select } = fakeDb(rows);
  const guard = new SessionAuthGuard(
    fakeReflector(isPublic),
    registry as unknown as SessionRegistryService,
    db,
    audit as unknown as AuditService,
  );
  return { guard, registry, audit, select };
}

function signedIn(
  session: Record<string, unknown>,
  { userAgent = FIREFOX_132, ip = SIGN_IN_IP } = {},
) {
  return fakeExecutionContext(
    fakeRequest({
      session: session as never,
      sessionID: 'sid-1',
      ip,
      get: ((name: string) =>
        name.toLowerCase() === 'user-agent' ? userAgent : undefined) as never,
    }),
  );
}

const FIREFOX_132 = 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0';
const FIREFOX_133 = 'Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0';
const CHROME_WINDOWS =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';
const SIGN_IN_IP = '2001:db8:1:2::10';

function withClient(client: Partial<SessionClient> = {}) {
  return {
    memberId: 'member-1',
    sessionEpoch: 0,
    client: {
      userAgent: FIREFOX_132,
      ip: SIGN_IN_IP,
      signedInAt: 1_000,
      ...client,
    },
  };
}

describe('SessionAuthGuard', () => {
  it('lets a @Public() route through with no session at all, without asking the registry', async () => {
    const { guard, registry, select } = setup(true);
    const ctx = fakeExecutionContext(fakeRequest({ session: {} as never }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(registry.isRegistered).not.toHaveBeenCalled();
    expect(select).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for a protected route with no memberId on the session', async () => {
    const { guard, registry } = setup(false);
    const ctx = fakeExecutionContext(fakeRequest({ session: {} as never }));
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
    expect(registry.isRegistered).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException for a protected route with no session object at all', async () => {
    const { guard } = setup(false);
    const ctx = fakeExecutionContext(fakeRequest({ session: undefined as never }));
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("allows a protected route through when the session carries a memberId and is in that member's registry", async () => {
    const { guard, registry } = setup(false, true, [{ sessionEpoch: 2 }]);
    const ctx = signedIn({ memberId: 'member-1', sessionEpoch: 2 });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(registry.isRegistered).toHaveBeenCalledWith('member-1', 'sid-1');
  });

  // A revoked session written back by a request that was still in flight.
  it('throws UnauthorizedException when the session carries a memberId but is not registered', async () => {
    const { guard } = setup(false, false);
    const ctx = signedIn({ memberId: 'member-1' });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it("throws UnauthorizedException for a session from before the member's current epoch", async () => {
    const { guard } = setup(false, true, [{ sessionEpoch: 3 }]);
    const ctx = signedIn({ memberId: 'member-1', sessionEpoch: 2 });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  it('counts a session without an epoch as epoch 0', async () => {
    const { guard } = setup(false, true, [{ sessionEpoch: 0 }]);
    await expect(guard.canActivate(signedIn({ memberId: 'member-1' }))).resolves.toBe(true);

    const bumped = setup(false, true, [{ sessionEpoch: 1 }]);
    await expect(bumped.guard.canActivate(signedIn({ memberId: 'member-1' }))).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('throws UnauthorizedException when the member no longer exists', async () => {
    const { guard } = setup(false, true, []);
    const ctx = signedIn({ memberId: 'member-1', sessionEpoch: 0 });
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });

  describe('client binding', () => {
    it('lets the browser that signed in through, updated or not, recording nothing', async () => {
      const { guard, registry, audit } = setup(false);
      const session = withClient();

      await expect(guard.canActivate(signedIn(session))).resolves.toBe(true);
      await expect(guard.canActivate(signedIn(session, { userAgent: FIREFOX_133 }))).resolves.toBe(
        true,
      );
      expect(registry.revoke).not.toHaveBeenCalled();
      expect(audit.record).not.toHaveBeenCalled();
      expect(session.client).not.toHaveProperty('lastIp');
    });

    // A cookie copied into another browser.
    it('ends the session and records session_device_mismatch for another browser or system', async () => {
      const { guard, registry, audit } = setup(false);

      await expect(
        guard.canActivate(
          signedIn(withClient(), { userAgent: CHROME_WINDOWS, ip: '198.51.100.9' }),
        ),
      ).rejects.toThrow(UnauthorizedException);
      expect(registry.revoke).toHaveBeenCalledWith('member-1', 'sid-1');
      expect(audit.record).toHaveBeenCalledWith(
        'session_device_mismatch',
        'member-1',
        '198.51.100.9',
        {
          signedInBrowser: 'Firefox',
          signedInOs: 'Linux',
          browser: 'Chrome',
          os: 'Windows',
        },
      );
    });

    it('counts a missing or unknown user agent as another device', async () => {
      const { guard, audit } = setup(false);

      await expect(guard.canActivate(signedIn(withClient(), { userAgent: '' }))).rejects.toThrow(
        UnauthorizedException,
      );
      expect(audit.record).toHaveBeenCalledWith('session_device_mismatch', 'member-1', SIGN_IN_IP, {
        signedInBrowser: 'Firefox',
        signedInOs: 'Linux',
        browser: 'unknown',
        os: 'unknown',
      });

      audit.record.mockClear();
      await expect(
        guard.canActivate(signedIn(withClient({ userAgent: null }), { userAgent: CHROME_WINDOWS })),
      ).rejects.toThrow(UnauthorizedException);
      expect(audit.record).toHaveBeenCalledWith('session_device_mismatch', 'member-1', SIGN_IN_IP, {
        signedInBrowser: 'unknown',
        signedInOs: 'unknown',
        browser: 'Chrome',
        os: 'Windows',
      });
    });

    it('skips the checks for a session signed in before its client was recorded', async () => {
      const { guard, audit } = setup(false);
      const ctx = signedIn(
        { memberId: 'member-1', sessionEpoch: 0 },
        { userAgent: CHROME_WINDOWS },
      );

      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(audit.record).not.toHaveBeenCalled();
    });

    // IPv6 privacy addresses rotate within the subscriber's /64.
    it('treats another address of the same /64 as the same network', async () => {
      const { guard, audit } = setup(false);
      const session = withClient();

      await guard.canActivate(signedIn(session, { ip: '2001:db8:1:2:dead:beef::1' }));
      expect(audit.record).not.toHaveBeenCalled();
      expect(session.client).not.toHaveProperty('lastIp');
    });

    it('keeps the session, remembers the address and records session_address_changed on a new network', async () => {
      const { guard, audit } = setup(false);
      const session = withClient();

      await expect(guard.canActivate(signedIn(session, { ip: '198.51.100.9' }))).resolves.toBe(
        true,
      );
      expect(session.client.lastIp).toBe('198.51.100.9');
      expect(audit.record).toHaveBeenCalledWith(
        'session_address_changed',
        'member-1',
        '198.51.100.9',
        { previousAddress: SIGN_IN_IP },
      );

      // The next request compares with the new network, not the sign-in one.
      audit.record.mockClear();
      await guard.canActivate(signedIn(session, { ip: '198.51.100.9' }));
      expect(audit.record).not.toHaveBeenCalled();
      await guard.canActivate(signedIn(session, { ip: '2001:db8:1:2::20' }));
      expect(audit.record).toHaveBeenCalledWith(
        'session_address_changed',
        'member-1',
        '2001:db8:1:2::20',
        { previousAddress: '198.51.100.9' },
      );
    });
  });
});
