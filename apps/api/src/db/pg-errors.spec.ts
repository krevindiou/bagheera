import { isUniqueViolation } from './pg-errors';

describe('isUniqueViolation', () => {
  it('matches a query error caused by a unique violation', () => {
    const err = Object.assign(new Error('duplicate key'), { cause: { code: '23505' } });
    expect(isUniqueViolation(err)).toBe(true);
  });

  it('rejects a query error with another Postgres code', () => {
    const err = Object.assign(new Error('foreign key'), { cause: { code: '23503' } });
    expect(isUniqueViolation(err)).toBe(false);
  });

  it('rejects an error without a cause', () => {
    expect(isUniqueViolation(new Error('connection lost'))).toBe(false);
  });

  it('rejects a non-object', () => {
    expect(isUniqueViolation('23505')).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});
