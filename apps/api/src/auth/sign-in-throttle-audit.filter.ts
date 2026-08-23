import {
  ArgumentsHost,
  Catch,
  HttpException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { GlobalExceptionFilter } from '../common/filters/global-exception.filter';
import { AuditService } from '../security/audit.service';

// Spelled out rather than compared against the HttpStatus enum: getStatus()
// returns a plain number, not an HttpStatus member (mirrors the same
// workaround in GlobalExceptionFilter).
const TOO_MANY_REQUESTS_STATUS = 429;

// Mirrors SignInService's own message so throttled/locked attempts are
// indistinguishable from ordinary wrong-password failures (spec 7: no
// enumeration signal from throttling).
const INVALID_CREDENTIALS = 'Invalid email or password';

/**
 * Sign-in-only: records a `sign_in_throttled` security event when
 * `RateLimitGuard` rejects a request, then rewrites the response into the
 * same generic 401 ordinary sign-in failures produce — a throttled or
 * locked-out caller must not be able to tell their attempt apart from a
 * plain wrong password.
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
      await super.catch(new UnauthorizedException(INVALID_CREDENTIALS), host);
      return;
    }
    await super.catch(exception, host);
  }
}
