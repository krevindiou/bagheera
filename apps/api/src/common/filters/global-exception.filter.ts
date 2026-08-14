import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { categorize, ErrorResponseBody } from './error-response';

/**
 * Single point producing every error response's shape, so clients can
 * branch on `category` instead of parsing messages or status codes. Wraps
 * both HttpExceptions (thrown deliberately, or by ValidationPipe/guards)
 * and anything unexpected (logged and reported as a generic 500).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: unknown, host: ArgumentsHost): void | Promise<void> {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const statusCode =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message = this.extractMessage(exception, statusCode);

    if (!(exception instanceof HttpException)) {
      this.logger.error(
        exception instanceof Error ? exception.stack : exception,
      );
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
