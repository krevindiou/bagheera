import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SessionAuthGuard } from './session-auth.guard';
import { fakeExecutionContext, fakeRequest } from '../test-support/fake-http-context';

function fakeReflector(isPublic: boolean | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
}

describe('SessionAuthGuard', () => {
  it('lets a @Public() route through with no session at all', () => {
    const guard = new SessionAuthGuard(fakeReflector(true));
    const ctx = fakeExecutionContext(fakeRequest({ session: {} as never }));
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws UnauthorizedException for a protected route with no memberId on the session', () => {
    const guard = new SessionAuthGuard(fakeReflector(false));
    const ctx = fakeExecutionContext(fakeRequest({ session: {} as never }));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('throws UnauthorizedException for a protected route with no session object at all', () => {
    const guard = new SessionAuthGuard(fakeReflector(false));
    const ctx = fakeExecutionContext(fakeRequest({ session: undefined as never }));
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('allows a protected route through when the session carries a memberId', () => {
    const guard = new SessionAuthGuard(fakeReflector(false));
    const ctx = fakeExecutionContext(fakeRequest({ session: { memberId: 'member-1' } as never }));
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
