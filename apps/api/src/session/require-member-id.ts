import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { MemberId } from '../security/ids';
import './session-data';

// The signed-in member's id, as a branded MemberId. Throws a 401 again
// even though SessionAuthGuard already does: defense in depth.
export function requireMemberId(req: Request): MemberId {
  const memberId = req.session?.memberId;
  if (!memberId) {
    throw new UnauthorizedException();
  }
  return memberId as MemberId;
}
