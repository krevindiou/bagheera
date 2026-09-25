import { errorCodeOf } from './error-codes';

describe('errorCodeOf', () => {
  it('maps a known business message to its code', () => {
    expect(errorCodeOf('Account is not active.')).toEqual({ code: 'account_not_active' });
  });

  it('extracts the limit and kind from a quota message', () => {
    expect(errorCodeOf('You can have at most 50 banks.')).toEqual({
      code: 'quota_exceeded',
      params: { limit: 50, kind: 'banks' },
    });
  });

  it('has no code for unknown messages or validation arrays', () => {
    expect(errorCodeOf('Something else')).toBeUndefined();
    expect(errorCodeOf(['a must be a string'])).toBeUndefined();
  });
});
