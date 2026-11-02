import { BadRequestException } from '@nestjs/common';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { fakeExecutionContext, fakeRequest } from '../../test-support/fake-http-context';
import { ImportListLimitGuard, MAX_KEYS } from './import-list-limit.guard';

const guard = new ImportListLimitGuard();

const check = (body: unknown) => guard.canActivate(fakeExecutionContext(fakeRequest({ body })));

const lines = (count: number) => Array.from({ length: count }, (_, i) => i + 1);

const manyKeys = (count: number) =>
  Object.fromEntries(Array.from({ length: count }, (_, i) => [`k${i}`, 0]));

const ACCOUNT_ID = '01890a5d-ac96-774b-bcce-b302099a8057';

function fullConfirmation() {
  const rows = lines(IMPORT_LIMITS.MAX_ROWS);
  return {
    labelChanges: rows.map((line) => ({ line, thirdParty: 'Somewhere', remember: false })),
    paymentMethodChanges: rows.map((line) => ({ line, paymentMethodId: ACCOUNT_ID })),
    categoryChanges: rows.map((line) => ({ line, categoryId: null })),
    transferAccountChanges: rows.map((line) => ({ line, accountId: ACCOUNT_ID })),
    revision: 'a'.repeat(64),
    reconcile: true,
    acceptAccountMismatch: false,
    reconcileLines: rows,
    includedLines: rows,
  };
}

describe('ImportListLimitGuard', () => {
  it('lets a request without a body through', () => {
    expect(check(undefined)).toBe(true);
    expect(check(null)).toBe(true);
  });

  it('accepts a full confirmation of the largest file', () => {
    expect(check(fullConfirmation())).toBe(true);
  });

  it('accepts unknown fields holding scalars, for the validation pipe to strip', () => {
    expect(check({ ...fullConfirmation(), extra: 'x', other: 1, more: null })).toBe(true);
    expect(
      check({ labelChanges: [{ line: 1, thirdParty: 'A', remember: false, extra: 'x' }] }),
    ).toBe(true);
  });

  it('leaves a scalar where a list belongs to the validation pipe', () => {
    expect(check({ labelChanges: 'nope', reconcileLines: 3 })).toBe(true);
  });

  it.each([
    'labelChanges',
    'paymentMethodChanges',
    'categoryChanges',
    'transferAccountChanges',
    'reconcileLines',
    'includedLines',
  ])('refuses %s longer than the most rows of a file', (field) => {
    expect(check({ [field]: lines(IMPORT_LIMITS.MAX_ROWS) })).toBe(true);
    expect(() => check({ [field]: lines(IMPORT_LIMITS.MAX_ROWS + 1) })).toThrow(
      BadRequestException,
    );
  });

  it.each([
    ['an array in a list', { reconcileLines: [1, [2]] }],
    ['an array at the end of a list', { labelChanges: [{ line: 1 }, []] }],
    ['an array in a change', { labelChanges: [{ line: [1] }] }],
    ['an object in a change', { categoryChanges: [{ line: 1, categoryId: {} }] }],
    ['an object as a field', { revision: { a: 1 } }],
    ['an object where a list belongs', { labelChanges: { line: 1 } }],
    ['an array as an unknown field', { extra: [] }],
  ])('refuses %s', (_, body) => {
    expect(() => check(body)).toThrow(BadRequestException);
  });

  it('refuses a body that is not an object', () => {
    expect(() => check([])).toThrow(BadRequestException);
    expect(() => check('labelChanges')).toThrow(BadRequestException);
  });

  it('refuses too many keys in the body, a change or a field', () => {
    expect(check(manyKeys(MAX_KEYS))).toBe(true);
    expect(() => check(manyKeys(MAX_KEYS + 1))).toThrow(BadRequestException);
    expect(check({ labelChanges: [manyKeys(MAX_KEYS)] })).toBe(true);
    expect(() => check({ labelChanges: [manyKeys(MAX_KEYS + 1)] })).toThrow(BadRequestException);
    expect(() => check({ revision: manyKeys(MAX_KEYS + 1) })).toThrow(BadRequestException);
  });

  // Compared pairwise, as class-transformer does, these keys take over 40 s.
  it('refuses an object of very many keys quickly', () => {
    const huge = manyKeys(238_000);
    const started = performance.now();

    for (const body of [huge, { labelChanges: [huge] }, { revision: huge }]) {
      expect(() => check(body)).toThrow(BadRequestException);
    }

    expect(performance.now() - started).toBeLessThan(3000);
  });
});
