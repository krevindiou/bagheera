import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSchedulerDto } from './create-scheduler.dto';
import { UpdateSchedulerDto } from './update-scheduler.dto';

const UUID_V7 = '00000000-0000-7000-8000-000000000001';

const valid = {
  accountId: UUID_V7,
  type: 'debit',
  thirdParty: 'Landlord',
  amount: 100,
  paymentMethodId: UUID_V7,
  valueDate: '2026-07-05',
  frequencyValue: 1,
};

describe.each([
  ['CreateSchedulerDto', CreateSchedulerDto],
  ['UpdateSchedulerDto', UpdateSchedulerDto],
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
