import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

// Audit-log address when the request has no `ip`.
export const CLIENT_IP_FALLBACK = 'unknown';

export const ClientIp = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string =>
    ctx.switchToHttp().getRequest<Request>().ip ?? CLIENT_IP_FALLBACK,
);
