import { HttpException, HttpStatus } from '@nestjs/common';

// A business-rule failure the client can translate: a stable `code` (and
// optional `params` to interpolate, e.g. a quota limit). `message` stays
// for consumers and logs that don't translate.
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
