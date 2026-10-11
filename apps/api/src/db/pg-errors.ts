// Postgres unique_violation. Drizzle wraps the driver error, so the code sits
// on `cause`.
const UNIQUE_VIOLATION = '23505';

/** Whether `err` is a Drizzle query error caused by a unique-index violation. */
export function isUniqueViolation(err: unknown): boolean {
  return (err as { cause?: { code?: string } } | null)?.cause?.code === UNIQUE_VIOLATION;
}
