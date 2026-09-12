import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSchedulerDto } from './create-scheduler.dto';
import { UpdateSchedulerDto } from './update-scheduler.dto';

const UUID_V7 = '00000000-0000-7000-8000-000000000001';

// Every other required field, held fixed, so validation errors below are
// isolated to frequencyValue/frequencyUnit.
function base(frequencyValue: number, frequencyUnit?: string) {
  return {
    accountId: UUID_V7,
    type: 'debit',
    thirdParty: 'Landlord',
    amount: 100,
    paymentMethodId: UUID_V7,
    valueDate: '2026-01-01',
    frequencyValue,
    ...(frequencyUnit !== undefined ? { frequencyUnit } : {}),
  };
}

describe.each([
  ['CreateSchedulerDto', CreateSchedulerDto],
  ['UpdateSchedulerDto', UpdateSchedulerDto],
])('%s frequency fields', (_name, Dto) => {
  it('accepts frequencyValue at the 100 cap', async () => {
    const dto = plainToInstance(Dto, base(100, 'month'));
    expect(await validate(dto)).toEqual([]);
  });

  // Regression case for 726f0aed: an unbounded frequencyValue paired with
  // 'month'/'year' can push a generated occurrence date past what
  // schedulers/generation/interval.ts's date arithmetic can safely handle.
  it('rejects frequencyValue above the 100 cap', async () => {
    const dto = plainToInstance(Dto, base(101, 'month'));
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'frequencyValue')?.constraints).toHaveProperty('max');
  });

  it('rejects a zero frequencyValue — it must be strictly positive', async () => {
    const dto = plainToInstance(Dto, base(0, 'month'));
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'frequencyValue')?.constraints).toHaveProperty(
      'isPositive',
    );
  });

  it('rejects a non-integer frequencyValue', async () => {
    const dto = plainToInstance(Dto, base(1.5, 'month'));
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'frequencyValue')?.constraints).toHaveProperty(
      'isInt',
    );
  });

  it.each(['day', 'week', 'month', 'year'])('accepts frequencyUnit %s', async (unit) => {
    const dto = plainToInstance(Dto, base(1, unit));
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a frequencyUnit outside day/week/month/year', async () => {
    const dto = plainToInstance(Dto, base(1, 'decade'));
    const errors = await validate(dto);
    expect(errors.find((e) => e.property === 'frequencyUnit')?.constraints).toHaveProperty('isIn');
  });

  it('allows frequencyUnit to be omitted — a scheduler need not repeat', async () => {
    const dto = plainToInstance(Dto, base(1));
    expect(await validate(dto)).toEqual([]);
  });
});
