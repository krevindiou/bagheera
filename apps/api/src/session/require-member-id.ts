import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import './session-data';

// The signed-in member's id, read off the session. `session-auth.guard.ts`
// already 401s on any request with no session before a controller runs;
// this throws again anyway — defense-in-depth against the guard ever being
// reordered or scoped differently, rather than trusting that guarantee
// silently. Every caller across the app goes through this one function
// instead of re-reading `req.session.memberId` itself.
export function requireMemberId(req: Request): number {
  const memberId = req.session.memberId;
  if (!memberId) {
    throw new UnauthorizedException();
  }
  return memberId;
}
