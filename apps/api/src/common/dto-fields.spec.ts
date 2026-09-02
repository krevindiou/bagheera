import { validate } from 'class-validator';
import { EmailField, NewPasswordField, SecretField } from './dto-fields';

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
