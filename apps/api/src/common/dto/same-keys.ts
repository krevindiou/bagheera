// Compile-time guard for a response DTO that mirrors a table row:
// `Assert<SameKeys<Dto, Row>>` only type-checks when both declare exactly
// the same keys. Adding a column then fails the build until the DTO either
// declares it or the service selects it out, instead of the column
// silently reaching clients undocumented (as scheduler.last_generated_date
// once did).
export type SameKeys<A, B> = [Exclude<keyof A, keyof B>, Exclude<keyof B, keyof A>] extends [
  never,
  never,
]
  ? true
  : false;

export type Assert<T extends true> = T;
