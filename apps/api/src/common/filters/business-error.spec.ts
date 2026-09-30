import { HttpStatus } from '@nestjs/common';
import { BusinessError } from './business-error';

describe('BusinessError', () => {
  it('carries the status, code and message the filter reads', () => {
    const err = new BusinessError(
      HttpStatus.BAD_REQUEST,
      'bank_required',
      'You must select a bank.',
    );
    expect(err.getStatus()).toBe(400);
    expect(err.message).toBe('You must select a bank.');
    expect(err.getResponse()).toEqual({
      message: 'You must select a bank.',
      code: 'bank_required',
    });
  });

  it('includes params in the response body when given', () => {
    const err = new BusinessError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'quota_exceeded',
      'You can have at most 50 banks.',
      { limit: 50, kind: 'banks' },
    );
    expect(err.getResponse()).toEqual({
      message: 'You can have at most 50 banks.',
      code: 'quota_exceeded',
      params: { limit: 50, kind: 'banks' },
    });
  });

  it('omits the params key entirely when none are given (not params: undefined)', () => {
    const err = new BusinessError(
      HttpStatus.BAD_REQUEST,
      'bank_required',
      'You must select a bank.',
    );
    expect('params' in (err.getResponse() as object)).toBe(false);
  });
});
