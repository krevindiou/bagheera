import type { TypedSchema } from 'vee-validate';
import type { z } from 'zod';

// @vee-validate/zod only supports zod 3, so this adapts a zod 4 schema to
// vee-validate's TypedSchema.
export function toTypedSchema<T extends z.ZodType>(
  schema: T,
): TypedSchema<z.input<T>, z.output<T>> {
  return {
    __type: 'VVTypedSchema',
    async parse(values) {
      const result = await schema.safeParseAsync(values);
      if (result.success) return { value: result.data, errors: [] };

      const byPath = new Map<string, string[]>();
      for (const { path, message } of result.error.issues) {
        const key = path.join('.');
        byPath.set(key, [...(byPath.get(key) ?? []), message]);
      }
      return { errors: [...byPath].map(([path, errors]) => ({ path, errors })) };
    },
  };
}
