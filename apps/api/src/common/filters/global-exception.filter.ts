import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
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

    if (
      !(exception instanceof HttpException) &&
      !this.isExposedHttpError(exception)
    ) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
      Sentry.captureException(exception);
    }

    const body: ErrorResponseBody = {
      statusCode,
      category: categorize(statusCode),
      message,
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

  // Express-level middleware outside Nest's own guard/pipe/interceptor
  // pipeline (e.g. csrf-csrf's doubleCsrfProtection) throws via the
  // `http-errors` package rather than Nest's HttpException, so it never
  // matches `instanceof HttpException` above. `http-errors` marks any
  // exception it's safe to show the client with `expose: true` (true for
  // 4xx, false for 5xx) — trust that flag rather than a bare numeric
  // `statusCode`, so an unrelated object that merely happens to carry a
  // `statusCode` property doesn't get misread as a deliberate HTTP error.
  private isExposedHttpError(
    exception: unknown,
  ): exception is Error & { statusCode: number } {
    return (
      exception instanceof Error &&
      'statusCode' in exception &&
      typeof (exception as { statusCode: unknown }).statusCode === 'number' &&
      (exception as { expose?: unknown }).expose === true
    );
  }

  private extractMessage(
    exception: unknown,
    statusCode: number,
  ): string | string[] {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();
      if (typeof response === 'string') {
        return response;
      }
      if (
        typeof response === 'object' &&
        response !== null &&
        'message' in response
      ) {
        const { message } = response as { message: string | string[] };
        return message;
      }
      return exception.message;
    }
    // 500, spelled out: statusCode is a plain number here
    // (HttpException.getStatus() returns number, not the HttpStatus enum),
    // so comparing it against the enum member trips the linter.
    const INTERNAL_SERVER_ERROR_STATUS = 500;
    if (statusCode === INTERNAL_SERVER_ERROR_STATUS) {
      return 'Internal server error';
    }
    return exception instanceof Error ? exception.message : 'Unknown error';
  }
}
