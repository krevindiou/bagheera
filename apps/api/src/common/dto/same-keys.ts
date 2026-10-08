// Compile-time guard for a response DTO mirroring a table row:
// `Assert<SameKeys<Dto, Row>>` only type-checks when both have exactly the
// same keys, so a new column fails the build until the DTO declares it or
// the service selects it out, instead of reaching clients undocumented.
export type SameKeys<A, B> = [Exclude<keyof A, keyof B>, Exclude<keyof B, keyof A>] extends [
  never,
  never,
]
  ? true
  : false;

export type Assert<T extends true> = T;
