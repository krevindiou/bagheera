import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { IS_PUBLIC_KEY } from './public.decorator';
import { sessionEpochOf } from './session-epoch';
import { SessionRegistryService } from './session-registry.service';
import './session-data';

/**
 * Global backstop for the "must be signed in" check. Services still read
 * the member id with `requireMemberId(req)` for scoping queries, but a new
 * controller that forgets to check first now gets a 401 here instead of
 * silently skipping auth.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessionRegistry: SessionRegistryService,
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    const memberId = req.session?.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    // Revocation drops the id from the registry, but a request still in
    // flight can write the session back to the store when it ends.
    if (!(await this.sessionRegistry.isRegistered(memberId, req.sessionID))) {
      throw new UnauthorizedException();
    }
    // Ends sessions from before a passkey removal or email change even when
    // the registry could not be updated at the time.
    const [row] = await this.db
      .select({ sessionEpoch: member.sessionEpoch })
      .from(member)
      .where(eq(member.id, memberId));
    if (!row || row.sessionEpoch !== sessionEpochOf(req.session)) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
