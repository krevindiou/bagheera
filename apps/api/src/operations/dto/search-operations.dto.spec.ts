// class-transformer's @Type() (used further down this file, on
// SearchOperationsDto.amountComparators) reflects design:type metadata at
// class-decoration time — needs the reflect-metadata polyfill loaded
// before the file evaluates. main.ts does this for the running app; no
// spec file has imported this DTO module directly before, so it's never
// come up in a unit test until now.
import 'reflect-metadata';
import { AMOUNT_CEILING } from '@bagheera/money';
import { validate } from 'class-validator';
import { AmountComparatorDto } from './search-operations.dto';

describe('AmountComparatorDto', () => {
  it('accepts a positive value at the ceiling', async () => {
    const dto = Object.assign(new AmountComparatorDto(), {
      operator: 'gte',
      value: AMOUNT_CEILING,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a value over the ceiling', async () => {
    const dto = Object.assign(new AmountComparatorDto(), {
      operator: 'gte',
      value: AMOUNT_CEILING + 1,
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('max');
  });

  it('accepts zero — a legal comparator threshold, unlike a stored amount', async () => {
    const dto = Object.assign(new AmountComparatorDto(), {
      operator: 'gte',
      value: 0,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a negative value — harmless as a comparator threshold', async () => {
    const dto = Object.assign(new AmountComparatorDto(), {
      operator: 'gte',
      value: -1,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an invalid operator', async () => {
    const dto = Object.assign(new AmountComparatorDto(), {
      operator: 'invalid',
      value: 1,
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('isIn');
  });
});
