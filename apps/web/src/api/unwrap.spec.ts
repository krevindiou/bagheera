import { describe, expect, it } from 'vitest';
import { unwrap } from './unwrap';

describe('unwrap', () => {
  it('returns data for a successful response', () => {
    expect(unwrap({ data: [1, 2, 3], response: { ok: true } as Response })).toEqual([1, 2, 3]);
  });

  it('throws the error message for a failed response', () => {
    expect(() =>
      unwrap({
        error: { message: 'Bank not found' },
        response: { ok: false, status: 404 } as Response,
      }),
    ).toThrow('Bank not found');
  });

  it('falls back to the status code when the error body has no message', () => {
    expect(() => unwrap({ response: { ok: false, status: 500 } as Response })).toThrow(
      'Request failed with status 500',
    );
  });
});
