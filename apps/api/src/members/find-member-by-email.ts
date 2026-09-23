import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Locale } from '../common/locale';
import { member } from '../db/schema';

export interface MemberByEmail {
  id: string;
  email: string;
  locale: Locale;
}

/** The member holding `email`, compared case-insensitively like member_email_unique does. */
export async function findMemberByEmail(
  db: NodePgDatabase,
  email: string,
): Promise<MemberByEmail | undefined> {
  const [row] = await db
    .select({ id: member.id, email: member.email, locale: member.locale })
    .from(member)
    .where(sql`lower(${member.email}) = lower(${email})`);
  return row;
}
