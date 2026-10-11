import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateOperationDto } from './update-operation.dto';

describe('UpdateOperationDto', () => {
  const valid = {
    accountId: '018f1e1e-0000-7000-8000-000000000000',
    type: 'debit',
    thirdParty: 'Grocer',
    amount: 10,
    paymentMethodId: '018f1e1e-0000-7000-8000-000000000001',
    valueDate: '2026-01-01',
    reconciled: false,
  };

  it('rejects a missing valueDate', async () => {
    const withoutValueDate: Partial<typeof valid> = { ...valid };
    delete withoutValueDate.valueDate;
    const errors = await validate(plainToInstance(UpdateOperationDto, withoutValueDate));
    expect(errors.some((error) => error.property === 'valueDate')).toBe(true);
  });

  it('accepts a present valueDate', async () => {
    const errors = await validate(plainToInstance(UpdateOperationDto, valid));
    expect(errors).toEqual([]);
  });
});
