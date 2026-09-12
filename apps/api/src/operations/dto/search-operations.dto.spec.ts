// class-transformer's @Type() (used below via SearchOperationsDto's
// @ValidateNested amountComparators) reads decorator metadata through
// Reflect.getMetadata — normally polyfilled once by main.ts at process
// start; an isolated unit-test file never runs main.ts, so it needs the
// same polyfill imported for itself.
import 'reflect-metadata';
import { AMOUNT_CEILING } from '@bagheera/money';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { SearchOperationsDto } from './search-operations.dto';

const UUID_V7 = '00000000-0000-7000-8000-000000000001';

describe('SearchOperationsDto', () => {
  it('accepts just the required accountId — every other field is optional', async () => {
    const dto = plainToInstance(SearchOperationsDto, { accountId: UUID_V7 });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a missing accountId', async () => {
    const dto = plainToInstance(SearchOperationsDto, {});
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'accountId')).toBe(true);
  });

  it('rejects a type outside debit/credit', async () => {
    const dto = plainToInstance(SearchOperationsDto, {
      accountId: UUID_V7,
      type: 'transfer',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'type')).toBe(true);
  });

  it('rejects more than 50 categoryIds', async () => {
    const dto = plainToInstance(SearchOperationsDto, {
      accountId: UUID_V7,
      categoryIds: Array.from({ length: 51 }, () => UUID_V7),
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categoryIds')).toBe(true);
  });

  it('rejects an invalid dateFrom', async () => {
    const dto = plainToInstance(SearchOperationsDto, {
      accountId: UUID_V7,
      dateFrom: 'not-a-date',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'dateFrom')).toBe(true);
  });

  it('rejects a non-boolean reconciled', async () => {
    const dto = plainToInstance(SearchOperationsDto, {
      accountId: UUID_V7,
      reconciled: 'yes',
    });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'reconciled')).toBe(true);
  });

  it('validates nested amountComparators via @ValidateNested/@Type, rejecting a bad operator', async () => {
    const dto = plainToInstance(SearchOperationsDto, {
      accountId: UUID_V7,
      amountComparators: [{ operator: 'between', value: 10 }],
    });
    const errors = await validate(dto);
    const nested = errors.find((e) => e.property === 'amountComparators');
    // children[0] is the per-array-index wrapper (property '0'); its own
    // children[0] is where the nested AmountComparatorDto's own field
    // errors land.
    expect(nested?.children?.[0]?.children?.[0]?.constraints).toHaveProperty('isIn');
  });

  it('validates nested amountComparators, rejecting a value above AMOUNT_CEILING', async () => {
    const dto = plainToInstance(SearchOperationsDto, {
      accountId: UUID_V7,
      amountComparators: [{ operator: 'gte', value: AMOUNT_CEILING + 1 }],
    });
    const errors = await validate(dto);
    const nested = errors.find((e) => e.property === 'amountComparators');
    expect(nested?.children?.[0]?.children?.[0]?.constraints).toHaveProperty('max');
  });

  it('accepts a fully populated, valid search', async () => {
    const dto = plainToInstance(SearchOperationsDto, {
      accountId: UUID_V7,
      type: 'debit',
      thirdParty: 'Landlord',
      categoryIds: [UUID_V7],
      paymentMethodIds: [UUID_V7],
      amountComparators: [
        { operator: 'gte', value: 10 },
        { operator: 'lte', value: 500 },
      ],
      dateFrom: '2026-01-01',
      dateTo: '2026-12-31',
      notes: 'rent',
      reconciled: true,
    });
    expect(await validate(dto)).toEqual([]);
  });
});
