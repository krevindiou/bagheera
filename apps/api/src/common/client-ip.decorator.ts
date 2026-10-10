import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Audit-log address when the request has no `ip`.
export const CLIENT_IP_FALLBACK = 'unknown';

export function clientIp(req: Request): string {
  return req.ip ?? CLIENT_IP_FALLBACK;
}

export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext): string =>
  clientIp(ctx.switchToHttp().getRequest<Request>()),
);
