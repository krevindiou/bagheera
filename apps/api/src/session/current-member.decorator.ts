import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import { requireMemberId } from './require-member-id';

// The signed-in member's id, so controllers hand services a plain memberId
// instead of the whole Express request.
export const CurrentMember = createParamDecorator((_data: unknown, ctx: ExecutionContext) =>
  requireMemberId(ctx.switchToHttp().getRequest<Request>()),
);
