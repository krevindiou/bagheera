import { describe, expect, it } from 'vitest';
import { profileSchema } from './settings.schemas';

describe('profileSchema', () => {
  it('accepts a valid email', () => {
    expect(profileSchema.safeParse({ email: 'member@example.com' }).success).toBe(true);
  });

  it('rejects an invalid email', () => {
    expect(profileSchema.safeParse({ email: 'not-an-email' }).success).toBe(false);
  });
});
