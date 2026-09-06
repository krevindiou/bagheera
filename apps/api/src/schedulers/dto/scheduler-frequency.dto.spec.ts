// CreateSchedulerDto and UpdateSchedulerDto carry a byte-identical
// frequencyValue field (same reasoning BatchIdsDto's consolidation already
// applied to a shared shape elsewhere in this codebase) — one file
// covering both rather than two near-duplicate spec files.
import { validate } from 'class-validator';
import { CreateSchedulerDto } from './create-scheduler.dto';
import { UpdateSchedulerDto } from './update-scheduler.dto';

const UUID = '00000000-0000-7000-8000-000000000001';

// Every other required field, valid and constant — only frequencyValue
// varies per test below.
function validBase() {
  return {
    accountId: UUID,
    type: 'debit' as const,
    thirdParty: 'Landlord',
    amount: 10,
    paymentMethodId: UUID,
    valueDate: '2026-01-15',
    frequencyValue: 1,
  };
}

describe('CreateSchedulerDto.frequencyValue', () => {
  it('accepts a value at the 100 cap', async () => {
    const dto = Object.assign(new CreateSchedulerDto(), {
      ...validBase(),
      frequencyValue: 100,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a value over the 100 cap', async () => {
    const dto = Object.assign(new CreateSchedulerDto(), {
      ...validBase(),
      frequencyValue: 101,
    });
    const errors = await validate(dto);
    const frequencyValueError = errors.find(
      (e) => e.property === 'frequencyValue',
    );
    expect(frequencyValueError?.constraints).toHaveProperty('max');
  });
});

describe('UpdateSchedulerDto.frequencyValue', () => {
  it('accepts a value at the 100 cap', async () => {
    const dto = Object.assign(new UpdateSchedulerDto(), {
      ...validBase(),
      frequencyValue: 100,
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a value over the 100 cap', async () => {
    const dto = Object.assign(new UpdateSchedulerDto(), {
      ...validBase(),
      frequencyValue: 101,
    });
    const errors = await validate(dto);
    const frequencyValueError = errors.find(
      (e) => e.property === 'frequencyValue',
    );
    expect(frequencyValueError?.constraints).toHaveProperty('max');
  });
});
