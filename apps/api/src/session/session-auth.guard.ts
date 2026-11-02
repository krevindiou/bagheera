import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
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
    return true;
  }
}
