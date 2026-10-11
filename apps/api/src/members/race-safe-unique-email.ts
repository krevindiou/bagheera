import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { isUniqueViolation } from '../db/pg-errors';
import { findMemberByEmail } from './find-member-by-email';

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
  const existing = await findMemberByEmail(db, email);
  if (existing && existing.id !== excludeId) {
    return { ok: false };
  }

  try {
    const value = await write();
    return { ok: true, value };
  } catch (err) {
    // The member_email_unique index caught a write that raced the precheck.
    if (isUniqueViolation(err)) {
      return { ok: false };
    }
    throw err;
  }
}
