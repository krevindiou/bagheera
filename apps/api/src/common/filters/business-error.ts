import { HttpException, HttpStatus } from '@nestjs/common';
import type { BusinessErrorCode } from '@bagheera/reference-data';

// A business-rule failure the client can translate: a stable `code` (and
// optional `params` to interpolate, e.g. a quota limit). `message` stays
// for consumers and logs that don't translate.
export class BusinessError extends HttpException {
  constructor(
    status: HttpStatus,
    code: BusinessErrorCode,
    message: string,
    params?: Record<string, string | number>,
  ) {
    super({ message, code, ...(params && { params }) }, status);
  }
}
