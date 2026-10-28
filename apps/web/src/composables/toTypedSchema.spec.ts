import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { toTypedSchema } from './toTypedSchema';

describe('toTypedSchema', () => {
  const schema = toTypedSchema(
    z.object({
      name: z.string().min(1, 'required'),
      amount: z.preprocess((value) => (value === '' ? undefined : Number(value)), z.number()),
    }),
  );

  it('returns the parsed output on success', async () => {
    expect(await schema.parse({ name: 'a', amount: '3' })).toEqual({
      value: { name: 'a', amount: 3 },
      errors: [],
    });
  });

  it('reports issue messages per field', async () => {
    const { value, errors } = await schema.parse({ name: '', amount: '' });

    expect(value).toBeUndefined();
    expect(errors).toEqual([
      { path: 'name', errors: ['required'] },
      { path: 'amount', errors: [expect.any(String)] },
    ]);
  });
});
