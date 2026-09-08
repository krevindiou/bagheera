import { UnauthorizedException } from '@nestjs/common';
import { requireMemberId } from './require-member-id';
import { fakeRequest } from '../test-support/fake-http-context';

describe('requireMemberId', () => {
  it('returns the signed-in member id from the session', () => {
    const req = fakeRequest({ session: { memberId: 'member-1' } as never });
    expect(requireMemberId(req)).toBe('member-1');
  });

  it('throws UnauthorizedException when the session has no memberId', () => {
    const req = fakeRequest({ session: {} as never });
    expect(() => requireMemberId(req)).toThrow(UnauthorizedException);
  });
});
