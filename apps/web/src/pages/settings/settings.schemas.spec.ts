import { describe, expect, it } from 'vitest';
import { changePasswordSchema, profileSchema } from './settings.schemas';

describe('profileSchema', () => {
  it('accepts a valid email with a non-empty current password', () => {
    expect(
      profileSchema.safeParse({ email: 'member@example.com', currentPassword: 'x' }).success,
    ).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(profileSchema.safeParse({ email: 'not-an-email', currentPassword: 'x' }).success).toBe(
      false,
    );
  });

  it('rejects an empty current password', () => {
    expect(
      profileSchema.safeParse({ email: 'member@example.com', currentPassword: '' }).success,
    ).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  const base = {
    currentPassword: 'x',
    newPassword: 'longenough',
    newPasswordConfirmation: 'longenough',
  };

  it('accepts matching new passwords', () => {
    expect(changePasswordSchema.safeParse(base).success).toBe(true);
  });

  it('rejects a mismatched confirmation', () => {
    expect(
      changePasswordSchema.safeParse({ ...base, newPasswordConfirmation: 'different' }).success,
    ).toBe(false);
  });

  it('rejects a new password under 8 chars', () => {
    expect(
      changePasswordSchema.safeParse({
        ...base,
        newPassword: 'short',
        newPasswordConfirmation: 'short',
      }).success,
    ).toBe(false);
  });
});
