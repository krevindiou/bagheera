import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateOperationDto } from './create-operation.dto';
import { UpdateOperationDto } from './update-operation.dto';

const valid = {
  accountId: '018f1e1e-0000-7000-8000-000000000000',
  type: 'debit',
  thirdParty: 'Grocer',
  amount: 10,
  paymentMethodId: '018f1e1e-0000-7000-8000-000000000001',
  valueDate: '2026-01-01',
};

describe.each([
  ['CreateOperationDto', CreateOperationDto],
  ['UpdateOperationDto', UpdateOperationDto],
])('%s amount', (_name, Dto) => {
  it('accepts an amount of one minor unit', async () => {
    expect(await validate(plainToInstance(Dto, { ...valid, amount: 0.0001 }))).toEqual([]);
  });

  it('rejects an amount that would round to zero minor units', async () => {
    const errors = await validate(plainToInstance(Dto, { ...valid, amount: 0.00001 }));
    expect(errors.map((error) => error.property)).toEqual(['amount']);
    expect(errors[0]?.constraints).toHaveProperty('min');
  });
});
