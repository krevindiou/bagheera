import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { member } from '../db/schema';

// Postgres unique_violation — guards the email-uniqueness race between the
// precheck below and `write()` (see member schema's case-insensitive
// unique index).
const UNIQUE_VIOLATION = '23505';

/**
 * Runs `write()` (an INSERT or UPDATE that sets `member.email` to `email`)
 * race-safely against the anti-enumeration requirement: resolves to
 * `{ ok: false }`, doing nothing else, if `email` is already taken by
 * another member — whether that's caught by the precheck here, or by the
 * database's unique index rejecting `write()` because another request
 * landed in the TOCTOU gap between the precheck and the write. A caller
 * must never translate `{ ok: false }` into a response that differs from
 * success, or it becomes an oracle for enumerating registered accounts —
 * see `RegistrationService.register` and `ProfileService.updateEmail`,
 * the two call sites this was extracted from.
 *
 * `excludeId`, when given, exempts that member's own current row from the
 * "taken" check — for an email *change*, "does someone else already have
 * this email" is the right question, not "does any row have it, including
 * the member's own unchanged one".
 */
export async function raceSafeUniqueEmail<T>(
  db: NodePgDatabase,
  email: string,
  write: () => Promise<T>,
  excludeId?: number,
): Promise<{ ok: true; value: T } | { ok: false }> {
  const [existing] = await db
    .select({ id: member.id })
    .from(member)
    .where(sql`lower(${member.email}) = lower(${email})`);
  if (existing && existing.id !== excludeId) {
    return { ok: false };
  }

  try {
    const value = await write();
    return { ok: true, value };
  } catch (err) {
    if (
      (err as { cause?: { code?: string } }).cause?.code === UNIQUE_VIOLATION
    ) {
      return { ok: false };
    }
    throw err;
  }
}
