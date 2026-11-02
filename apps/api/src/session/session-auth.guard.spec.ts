import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionAuthGuard } from './session-auth.guard';
import type { SessionRegistryService } from './session-registry.service';
import { fakeExecutionContext, fakeRequest } from '../test-support/fake-http-context';
import { vi } from 'vitest';

function fakeReflector(isPublic: boolean | undefined): Reflector {
  return {
    getAllAndOverride: vi.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
}

function setup(isPublic: boolean | undefined, registered = true) {
  const registry = { isRegistered: vi.fn().mockResolvedValue(registered) };
  const guard = new SessionAuthGuard(
    fakeReflector(isPublic),
    registry as unknown as SessionRegistryService,
  );
  return { guard, registry };
}

describe('SessionAuthGuard', () => {
  it('lets a @Public() route through with no session at all, without asking the registry', async () => {
    const { guard, registry } = setup(true);
    const ctx = fakeExecutionContext(fakeRequest({ session: {} as never }));
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(registry.isRegistered).not.toHaveBeenCalled();
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
    const { guard, registry } = setup(false, true);
    const ctx = fakeExecutionContext(
      fakeRequest({ session: { memberId: 'member-1' } as never, sessionID: 'sid-1' }),
    );
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(registry.isRegistered).toHaveBeenCalledWith('member-1', 'sid-1');
  });

  // A revoked session written back by a request that was still in flight.
  it('throws UnauthorizedException when the session carries a memberId but is not registered', async () => {
    const { guard } = setup(false, false);
    const ctx = fakeExecutionContext(
      fakeRequest({ session: { memberId: 'member-1' } as never, sessionID: 'sid-1' }),
    );
    await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
  });
});
