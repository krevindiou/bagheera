import { validate } from 'class-validator';
import {
  AccountNameField,
  BankNameField,
  EmailField,
  NewPasswordField,
  NotesField,
  ReportTitleField,
  SecretField,
  ThirdPartyField,
} from './dto-fields';

class EmailHolder {
  @EmailField()
  email!: string;
}

class SecretHolder {
  @SecretField()
  value!: string;
}

class NewPasswordHolder {
  @NewPasswordField()
  value!: string;
}

class AccountNameHolder {
  @AccountNameField()
  name!: string;
}

class ThirdPartyHolder {
  @ThirdPartyField()
  thirdParty!: string;
}

class ReportTitleHolder {
  @ReportTitleField()
  title!: string;
}

class BankNameHolder {
  @BankNameField()
  name!: string;
}

class NotesHolder {
  @NotesField()
  notes?: string;
}

describe('EmailField', () => {
  it('accepts a well-formed email under the cap', async () => {
    const dto = Object.assign(new EmailHolder(), { email: 'a@example.com' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a non-email value', async () => {
    const dto = Object.assign(new EmailHolder(), { email: 'not-an-email' });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('isEmail');
  });

  it('rejects an email over the 128-char cap', async () => {
    const local = 'a'.repeat(122); // + '@a.com' = 128 exactly
    const dto = Object.assign(new EmailHolder(), {
      email: `${local}x@a.com`, // one over
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });
});

describe('SecretField', () => {
  it('accepts a non-empty string under the cap', async () => {
    const dto = Object.assign(new SecretHolder(), { value: 'x' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty string', async () => {
    const dto = Object.assign(new SecretHolder(), { value: '' });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('isNotEmpty');
  });

  it('rejects a value over the 4096-char cap', async () => {
    const dto = Object.assign(new SecretHolder(), { value: 'x'.repeat(4097) });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });

  it('imposes no minimum length beyond non-empty', async () => {
    const dto = Object.assign(new SecretHolder(), { value: 'x' });
    expect(await validate(dto)).toHaveLength(0);
  });
});

describe('NewPasswordField', () => {
  it('accepts a value between 8 and 4096 chars', async () => {
    const dto = Object.assign(new NewPasswordHolder(), {
      value: 'x'.repeat(8),
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a value under the 8-char minimum', async () => {
    const dto = Object.assign(new NewPasswordHolder(), {
      value: 'x'.repeat(7),
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('isLength');
  });

  it('rejects a value over the 4096-char cap', async () => {
    const dto = Object.assign(new NewPasswordHolder(), {
      value: 'x'.repeat(4097),
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('isLength');
  });
});

describe('AccountNameField', () => {
  it('accepts a non-empty name under the cap', async () => {
    const dto = Object.assign(new AccountNameHolder(), { name: 'Checking' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty name', async () => {
    const dto = Object.assign(new AccountNameHolder(), { name: '' });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('rejects a name over the 64-char cap', async () => {
    const dto = Object.assign(new AccountNameHolder(), {
      name: 'x'.repeat(65),
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });
});

describe('ThirdPartyField', () => {
  it('accepts a non-empty value under the cap', async () => {
    const dto = Object.assign(new ThirdPartyHolder(), { thirdParty: 'Amazon' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty value', async () => {
    const dto = Object.assign(new ThirdPartyHolder(), { thirdParty: '' });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('rejects a value over the 64-char cap', async () => {
    const dto = Object.assign(new ThirdPartyHolder(), {
      thirdParty: 'x'.repeat(65),
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });
});

describe('ReportTitleField', () => {
  it('accepts a non-empty title under the cap', async () => {
    const dto = Object.assign(new ReportTitleHolder(), {
      title: 'Monthly spend',
    });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty title', async () => {
    const dto = Object.assign(new ReportTitleHolder(), { title: '' });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('rejects a title over the 64-char cap', async () => {
    const dto = Object.assign(new ReportTitleHolder(), {
      title: 'x'.repeat(65),
    });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });
});

describe('BankNameField', () => {
  it('accepts a non-empty name under the 32-char cap', async () => {
    const dto = Object.assign(new BankNameHolder(), { name: 'My Bank' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects an empty name', async () => {
    const dto = Object.assign(new BankNameHolder(), { name: '' });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('minLength');
  });

  it('rejects a name over the 32-char cap — narrower than the other name-like fields', async () => {
    const dto = Object.assign(new BankNameHolder(), { name: 'x'.repeat(33) });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });
});

describe('NotesField', () => {
  it('accepts being omitted — optional', async () => {
    const dto = Object.assign(new NotesHolder(), {});
    expect(await validate(dto)).toHaveLength(0);
  });

  it('accepts a non-empty value under the 4096-char cap', async () => {
    const dto = Object.assign(new NotesHolder(), { notes: 'x' });
    expect(await validate(dto)).toHaveLength(0);
  });

  it('rejects a value over the 4096-char cap', async () => {
    const dto = Object.assign(new NotesHolder(), { notes: 'x'.repeat(4097) });
    const errors = await validate(dto);
    expect(errors[0].constraints).toHaveProperty('maxLength');
  });
});
