import { describe, expect, it } from 'vitest';
import {
  forgotPasswordSchema,
  registerSchema,
  resetPasswordSchema,
  signInSchema,
} from './auth.schemas';

describe('signInSchema', () => {
  it('accepts any non-empty email/password pair, format unchecked', () => {
    expect(signInSchema.safeParse({ email: 'not-even-an-email', password: 'x' }).success).toBe(
      true,
    );
  });

  it('rejects an empty email or password', () => {
    expect(signInSchema.safeParse({ email: '', password: 'x' }).success).toBe(false);
    expect(signInSchema.safeParse({ email: 'a@example.com', password: '' }).success).toBe(false);
  });
});

describe('registerSchema', () => {
  const base = {
    email: 'member@example.com',
    country: 'US',
    password: 'longenough1',
    passwordConfirmation: 'longenough1',
  };

  it('accepts matching passwords and a 2-letter country', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a mismatched password confirmation', () => {
    const result = registerSchema.safeParse({ ...base, passwordConfirmation: 'different' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0].path).toEqual(['passwordConfirmation']);
  });

  it('rejects a password under 8 chars', () => {
    expect(
      registerSchema.safeParse({ ...base, password: 'short', passwordConfirmation: 'short' })
        .success,
    ).toBe(false);
  });

  it('rejects an 8+ char password made of only one character class', () => {
    expect(
      registerSchema.safeParse({
        ...base,
        password: 'alllowercase',
        passwordConfirmation: 'alllowercase',
      }).success,
    ).toBe(false);
  });

  it("rejects a country code that isn't exactly 2 letters", () => {
    expect(registerSchema.safeParse({ ...base, country: 'USA' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(registerSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('forgotPasswordSchema', () => {
  it('requires a well-formed email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
    expect(forgotPasswordSchema.safeParse({ email: 'a@example.com' }).success).toBe(true);
  });
});

describe('resetPasswordSchema', () => {
  it('rejects a mismatched confirmation', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'longenough1',
      passwordConfirmation: 'different',
    });
    expect(result.success).toBe(false);
  });

  it('accepts matching passwords', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'longenough1',
        passwordConfirmation: 'longenough1',
      }).success,
    ).toBe(true);
  });

  it('rejects an 8+ char password made of only one character class', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'alllowercase',
        passwordConfirmation: 'alllowercase',
      }).success,
    ).toBe(false);
  });
});
