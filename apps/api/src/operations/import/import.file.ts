import { HttpStatus } from '@nestjs/common';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { BusinessError } from '../../common/filters/business-error';
import {
  OfxFormatError,
  OfxLimitError,
  OfxStatementError,
  parseOfx,
  type OfxStatement,
} from './ofx';

export function invalidFile(message: string): BusinessError {
  return new BusinessError(HttpStatus.BAD_REQUEST, 'import_file_invalid', message);
}

// Reads a bank file, answering what is wrong with it as a business error.
export function readStatement(buffer: Buffer): OfxStatement {
  try {
    return parseOfx(buffer, { maxRows: IMPORT_LIMITS.MAX_ROWS });
  } catch (err) {
    if (err instanceof OfxLimitError) {
      throw new BusinessError(
        HttpStatus.BAD_REQUEST,
        'import_too_many_rows',
        'The file holds too many rows.',
        { limit: IMPORT_LIMITS.MAX_ROWS },
      );
    }
    if (err instanceof OfxStatementError) {
      throw err.reason === 'several'
        ? new BusinessError(
            HttpStatus.BAD_REQUEST,
            'import_statement_several',
            'The file holds more than one statement.',
          )
        : new BusinessError(
            HttpStatus.BAD_REQUEST,
            'import_statement_unsupported',
            'The statement is neither of a bank account nor of a credit card.',
          );
    }
    if (err instanceof OfxFormatError) throw invalidFile('The file is not a valid OFX file.');
    throw err;
  }
}
