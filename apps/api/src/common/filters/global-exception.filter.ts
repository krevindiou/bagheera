import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Sentry } from '../../logging/sentry';
import { categorize, ErrorResponseBody } from './error-response';

/**
 * Single point producing every error response's shape, so clients can
 * branch on `category` instead of parsing messages or status codes. Wraps
 * HttpExceptions (thrown deliberately, or by ValidationPipe/guards),
 * exposed `http-errors`-style exceptions raised by Express-level
 * middleware outside Nest's own pipeline (e.g. csrf-csrf's CSRF-rejection
 * error), and anything unexpected (logged and reported as a generic 500).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost): void | Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode = this.statusCodeOf(exception);
    const message = this.extractMessage(exception, statusCode);

    if (!(exception instanceof HttpException) && !this.isExposedHttpError(exception)) {
      this.logger.error(exception instanceof Error ? exception.stack : exception);
      Sentry.captureException(exception);
    }

    const body: ErrorResponseBody = {
      statusCode,
      category: categorize(statusCode),
      message,
      ...this.extractBusinessCode(exception),
      path: request.url,
      timestamp: new Date().toISOString(),
    };

    response.status(statusCode).json(body);
  }

  private statusCodeOf(exception: unknown): number {
    if (exception instanceof HttpException) {
      return exception.getStatus();
    }
    if (this.isExposedHttpError(exception)) {
      return exception.statusCode;
    }
    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  // Express middleware (e.g. csrf-csrf) throws `http-errors`, not
  // HttpException. Trust its `expose` flag (true for 4xx) rather than a bare
  // `statusCode`, which an unrelated error could carry too.
  private isExposedHttpError(exception: unknown): exception is Error & { statusCode: number } {
    return (
      exception instanceof Error &&
      'statusCode' in exception &&
      typeof (exception as { statusCode: unknown }).statusCode === 'number' &&
      (exception as { expose?: unknown }).expose === true
    );
  }

  private extractBusinessCode(
    exception: unknown,
  ): { code: string; params?: Record<string, string | number> } | Record<string, never> {
    if (!(exception instanceof HttpException)) {
      return {};
    }
    const response = exception.getResponse();
    if (typeof response !== 'object' || response === null || !('code' in response)) {
      return {};
    }
    const { code, params } = response as {
      code: unknown;
      params?: Record<string, string | number>;
    };
    return typeof code === 'string' ? { code, params } : {};
  }

  private extractMessage(exception: unknown, statusCode: number): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (typeof response === 'object' && response !== null && 'message' in response) {
        const { message } = response as { message: string | string[] };
        return message;
      }
      return exception.message;
    }
    // A plain number: comparing against the HttpStatus enum trips the linter.
    const INTERNAL_SERVER_ERROR_STATUS = 500;
    if (statusCode === INTERNAL_SERVER_ERROR_STATUS) {
      return 'Internal server error';
    }
    // Only an exposed http-errors error gets here, and that is an Error.
    return (exception as Error).message;
  }
}
