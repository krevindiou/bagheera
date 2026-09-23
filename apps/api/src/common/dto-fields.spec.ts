import { AMOUNT_CEILING } from '@bagheera/money';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AccountNameField,
  AmountField,
  BankNameField,
  EmailField,
  NotesField,
  ReportTitleField,
  SecretField,
  ThirdPartyField,
  ValueDateField,
} from './dto-fields';

class EmailFieldHost {
  @EmailField() value!: string;
}
class SecretFieldHost {
  @SecretField() value!: string;
}
class ThirdPartyFieldHost {
  @ThirdPartyField() value!: string;
}
class AccountNameFieldHost {
  @AccountNameField() value!: string;
}
class ReportTitleFieldHost {
  @ReportTitleField() value!: string;
}
class BankNameFieldHost {
  @BankNameField() value!: string;
}
class NotesFieldHost {
  @NotesField() value?: string;
}
class AmountFieldHost {
  @AmountField() value!: number;
}
class ValueDateFieldHost {
  @ValueDateField() valueDate!: string;
}

describe('EmailField', () => {
  it('accepts a valid email under the column width', async () => {
    const dto = plainToInstance(EmailFieldHost, { value: 'a@b.com' });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a non-email string', async () => {
    const dto = plainToInstance(EmailFieldHost, { value: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('isEmail');
  });

  it('rejects an email longer than 128 characters', async () => {
    const local = 'a'.repeat(150);
    const dto = plainToInstance(EmailFieldHost, { value: `${local}@b.com` });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('maxLength');
  });
});

describe('SecretField', () => {
  it('accepts a non-empty string with no minimum length', async () => {
    const dto = plainToInstance(SecretFieldHost, { value: 'x' });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects an empty string', async () => {
    const dto = plainToInstance(SecretFieldHost, { value: '' });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects a string longer than 4096 characters', async () => {
    const dto = plainToInstance(SecretFieldHost, { value: 'x'.repeat(4097) });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('maxLength');
  });
});

describe('ThirdPartyField (boundedName, 64 chars)', () => {
  it('rejects an empty string', async () => {
    const dto = plainToInstance(ThirdPartyFieldHost, { value: '' });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('minLength');
  });

  it('accepts a name up to 64 characters', async () => {
    const dto = plainToInstance(ThirdPartyFieldHost, { value: 'x'.repeat(64) });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a name longer than 64 characters', async () => {
    const dto = plainToInstance(ThirdPartyFieldHost, { value: 'x'.repeat(65) });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('maxLength');
  });
});

describe('AccountNameField and ReportTitleField (same boundedName shape, 64 chars)', () => {
  it('AccountNameField rejects a name longer than 64 characters', async () => {
    const dto = plainToInstance(AccountNameFieldHost, {
      value: 'x'.repeat(65),
    });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('maxLength');
  });

  it('ReportTitleField rejects a name longer than 64 characters', async () => {
    const dto = plainToInstance(ReportTitleFieldHost, {
      value: 'x'.repeat(65),
    });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('maxLength');
  });
});

describe('BankNameField (boundedName, narrower 32-char cap)', () => {
  it('accepts a name up to 32 characters', async () => {
    const dto = plainToInstance(BankNameFieldHost, { value: 'x'.repeat(32) });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a name of 33 characters, even though ThirdPartyField would accept it', async () => {
    const dto = plainToInstance(BankNameFieldHost, { value: 'x'.repeat(33) });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('maxLength');
  });
});

describe('NotesField', () => {
  it('is optional — undefined passes', async () => {
    const dto = plainToInstance(NotesFieldHost, {});
    expect(await validate(dto)).toEqual([]);
  });

  it('accepts a note within 4096 characters', async () => {
    const dto = plainToInstance(NotesFieldHost, { value: 'x'.repeat(4096) });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects a note longer than 4096 characters', async () => {
    const dto = plainToInstance(NotesFieldHost, { value: 'x'.repeat(4097) });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('maxLength');
  });
});

describe('AmountField', () => {
  it('accepts a positive amount up to AMOUNT_CEILING', async () => {
    const dto = plainToInstance(AmountFieldHost, { value: AMOUNT_CEILING });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects an amount above AMOUNT_CEILING', async () => {
    const dto = plainToInstance(AmountFieldHost, { value: AMOUNT_CEILING + 1 });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('max');
  });

  it('rejects zero — the sign/magnitude comes from the amount, so it must be strictly positive', async () => {
    const dto = plainToInstance(AmountFieldHost, { value: 0 });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('isPositive');
  });

  it('rejects a negative amount', async () => {
    const dto = plainToInstance(AmountFieldHost, { value: -5 });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('isPositive');
  });
});

// The exact date rule is covered by value-date.spec.ts — this only pins the
// decorator's wiring and message.
describe('ValueDateField', () => {
  it('accepts a plain in-range date', async () => {
    const dto = plainToInstance(ValueDateFieldHost, { valueDate: '2026-01-01' });
    expect(await validate(dto)).toEqual([]);
  });

  it('rejects an out-of-range date, naming the field and the accepted range', async () => {
    const dto = plainToInstance(ValueDateFieldHost, { valueDate: '9999-12-31' });
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toEqual({
      isValueDate: 'valueDate must be a YYYY-MM-DD date between 1900-01-01 and 2100-12-31',
    });
  });

  it('is required by default — a missing value fails', async () => {
    const dto = plainToInstance(ValueDateFieldHost, {});
    const errors = await validate(dto);
    expect(errors[0]?.constraints).toHaveProperty('isValueDate');
  });
});
