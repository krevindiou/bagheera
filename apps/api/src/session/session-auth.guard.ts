import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from './public.decorator';
import './session-data';

/**
 * Global backstop for the "must be signed in" check. Services still read
 * the member id with `requireMemberId(req)` for scoping queries, but a new
 * controller that forgets to check first now gets a 401 here instead of
 * silently skipping auth.
 */
@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const req = context.switchToHttp().getRequest<Request>();
    if (!req.session?.memberId) {
      throw new UnauthorizedException();
    }
    return true;
  }
}
