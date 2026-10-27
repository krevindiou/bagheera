import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  PayloadTooLargeException,
} from '@nestjs/common';
import { BusinessError } from '../../common/filters/business-error';
import { GlobalExceptionFilter } from '../../common/filters/global-exception.filter';

// multer cuts an upload off with a bare 413; answer with the same business
// error the service gives a file just over the limit.
@Catch(PayloadTooLargeException)
export class PayloadTooLargeToBusinessError implements ExceptionFilter {
  private readonly global = new GlobalExceptionFilter();

  catch(_exception: PayloadTooLargeException, host: ArgumentsHost): void | Promise<void> {
    return this.global.catch(
      new BusinessError(
        HttpStatus.PAYLOAD_TOO_LARGE,
        'import_file_too_large',
        'The file is too large.',
      ),
      host,
    );
  }
}
