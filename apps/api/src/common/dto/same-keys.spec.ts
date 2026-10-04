import { expectTypeOf } from 'vitest';
import type { SameKeys } from './same-keys';

// Type-level only: checked by `tsc -p tsconfig.json --noEmit` (CI's lint
// job), the runtime assertions are no-ops.
describe('SameKeys', () => {
  it('is true only for exactly the same keys, whatever the value types', () => {
    expectTypeOf<SameKeys<{ a: string; b: number }, { b: Date; a: null }>>().toEqualTypeOf<true>();
    expectTypeOf<SameKeys<{ a: string }, { a: string; extra: number }>>().toEqualTypeOf<false>();
    expectTypeOf<SameKeys<{ a: string; extra: number }, { a: string }>>().toEqualTypeOf<false>();
  });
});
