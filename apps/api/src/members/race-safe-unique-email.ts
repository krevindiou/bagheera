import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { member } from '../db/schema';

// Postgres unique_violation (member_email_unique).
const UNIQUE_VIOLATION = '23505';

/**
 * Runs `write()` (setting `member.email` to `email`), resolving to
 * `{ ok: false }` when another member holds `email`, whether caught by the
 * precheck or by the unique index in the gap after it. Only surface
 * `{ ok: false }` to a caller who has proved control of `email`, or it
 * becomes an account-enumeration oracle.
 *
 * `excludeId` exempts that member's own row from the check.
 */
export async function raceSafeUniqueEmail<T>(
  db: NodePgDatabase,
  email: string,
  write: () => Promise<T>,
  excludeId?: string,
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
    if ((err as { cause?: { code?: string } }).cause?.code === UNIQUE_VIOLATION) {
      return { ok: false };
    }
    throw err;
  }
}
