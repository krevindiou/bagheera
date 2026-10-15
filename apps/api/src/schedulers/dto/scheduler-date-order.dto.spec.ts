import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateSchedulerDto } from './create-scheduler.dto';
import { UpdateSchedulerDto } from './update-scheduler.dto';

const UUID_V7 = '00000000-0000-7000-8000-000000000001';

// Every other required field, held fixed, so validation errors below are
// isolated to limitDate/valueDate ordering.
function base(valueDate: string, limitDate?: string) {
  return {
    accountId: UUID_V7,
    type: 'debit',
    thirdParty: 'Landlord',
    amount: 100,
    paymentMethodId: UUID_V7,
    valueDate,
    frequencyValue: 1,
    ...(limitDate !== undefined ? { limitDate } : {}),
  };
}

describe.each([
  ['CreateSchedulerDto', CreateSchedulerDto],
  ['UpdateSchedulerDto', UpdateSchedulerDto],
])('%s limitDate/valueDate order', (_name, Dto) => {
  it('accepts a limitDate after or equal to valueDate', async () => {
    expect(await validate(plainToInstance(Dto, base('2026-07-05', '2026-08-01')))).toEqual([]);
    expect(await validate(plainToInstance(Dto, base('2026-07-05', '2026-07-05')))).toEqual([]);
  });

  it('rejects a limitDate before valueDate', async () => {
    const errors = await validate(plainToInstance(Dto, base('2026-07-05', '2026-06-01')));
    expect(errors.find((e) => e.property === 'limitDate')?.constraints).toEqual({
      isOnOrAfter: 'limitDate must be on or after valueDate',
    });
  });

  it('leaves an unset limitDate alone', async () => {
    expect(await validate(plainToInstance(Dto, base('2026-07-05')))).toEqual([]);
  });
});
