import { HttpException, HttpStatus } from '@nestjs/common';

// A business-rule failure the client can translate, carrying a stable
// `code` (and optional `params` to interpolate, e.g. a quota limit)
// directly in its response — replaces GlobalExceptionFilter deriving a
// code after the fact by matching the English `message` text against a
// lookup table (error-codes.ts's now-deleted ERROR_CODE_BY_MESSAGE):
// rewording `message` here can no longer silently drop its code, since
// there's nothing else to keep in sync. `message` stays in the response
// for API consumers/logs that don't translate.
export class BusinessError extends HttpException {
  constructor(
    status: HttpStatus,
    code: string,
    message: string,
    params?: Record<string, string | number>,
  ) {
    super({ message, code, ...(params && { params }) }, status);
  }
}
