import { describe, expect, it } from 'vitest';
import { registerSchema } from './auth.schemas';

describe('registerSchema', () => {
  const base = { email: 'member@example.com', country: 'US' };

  it('accepts a valid email and a 2-letter country', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a country code that isn't exactly 2 letters", () => {
    expect(registerSchema.safeParse({ ...base, country: 'USA' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(registerSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });
});
