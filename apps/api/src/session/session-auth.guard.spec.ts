import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { SessionAuthGuard } from './session-auth.guard';
import type { SessionRegistryService } from './session-registry.service';
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
  const registry = { isRegistered: vi.fn().mockResolvedValue(registered) };
  const { db, select } = fakeDb(rows);
  const guard = new SessionAuthGuard(
    fakeReflector(isPublic),
    registry as unknown as SessionRegistryService,
    db,
  );
  return { guard, registry, select };
}

function signedIn(session: Record<string, unknown>) {
  return fakeExecutionContext(fakeRequest({ session: session as never, sessionID: 'sid-1' }));
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
});
