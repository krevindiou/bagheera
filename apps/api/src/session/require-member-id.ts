import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { MemberId } from '../security/ids';
import './session-data';

// The signed-in member's id, read off the session. `session-auth.guard.ts`
// already 401s on any request with no session before a controller runs;
// this throws again anyway — defense-in-depth against the guard ever being
// reordered or scoped differently, rather than trusting that guarantee
// silently. Every caller across the app goes through this one function
// instead of re-reading `req.session.memberId` itself.
//
// Branded MemberId (see security/ids.ts) — the session store itself only
// knows `string`, so this cast is the one place a raw session value becomes
// the typed id every OwnershipService call relies on downstream.
export function requireMemberId(req: Request): MemberId {
  const memberId = req.session.memberId;
  if (!memberId) {
    throw new UnauthorizedException();
  }
  return memberId as MemberId;
}
