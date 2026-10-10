import { describe, expect, it } from 'vitest';
import { registerSchema } from './auth.schemas';

describe('registerSchema', () => {
  const base = { email: 'member@example.com', country: 'US' };

  it('accepts a valid email and an ISO country code', () => {
    expect(registerSchema.safeParse(base).success).toBe(true);
  });

  it("rejects a country code that isn't exactly 2 letters", () => {
    expect(registerSchema.safeParse({ ...base, country: 'USA' }).success).toBe(false);
  });

  it('rejects a well-formed code that is not an ISO 3166-1 country', () => {
    expect(registerSchema.safeParse({ ...base, country: 'ZZ' }).success).toBe(false);
  });

  it('rejects a lowercase code, which the API would only accept after normalizing', () => {
    expect(registerSchema.safeParse({ ...base, country: 'us' }).success).toBe(false);
  });

  it('rejects an invalid email', () => {
    expect(registerSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });
});
