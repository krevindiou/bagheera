import {
  ArgumentsHost,
  Catch,
  HttpException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { AuditService } from '../security/audit.service';

// Spelled out rather than compared against the HttpStatus enum: getStatus()
// returns a plain number, not an HttpStatus member (mirrors the same
// workaround in GlobalExceptionFilter).
const TOO_MANY_REQUESTS_STATUS = 429;

/**
 * Sign-in-only: records a `sign_in_throttled` security event when
 * `RateLimitGuard` rejects a request, then falls through to the app's
 * normal error-response shape (additive on top
 * of RateLimitGuard's existing 429 behavior — no response change).
 */
@Injectable()
@Catch()
export class SignInThrottleAuditFilter extends GlobalExceptionFilter {
  constructor(private readonly audit: AuditService) {
    super();
  }

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    if (
      exception instanceof HttpException &&
      exception.getStatus() === TOO_MANY_REQUESTS_STATUS
    ) {
      const req = host.switchToHttp().getRequest<Request>();
      await this.audit.record('sign_in_throttled', null, req.ip ?? 'unknown');
    }
    await super.catch(exception, host);
  }
}
