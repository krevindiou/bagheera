import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { member } from '../db/schema';
import { appTimeZone, localIsoDate } from './local-date';

// A member's own time zone, or APP_TIMEZONE for one who has none on file
// (see `member.time_zone`).
export function effectiveTimeZone(timeZone: string | null | undefined): string {
  return timeZone ?? appTimeZone();
}

// The member's calendar day (`YYYY-MM-DD`): what "today" means for their
// dashboard, reports and scheduler catch-up.
export async function memberToday(
  db: NodePgDatabase,
  memberId: string,
  now: Date = new Date(),
): Promise<string> {
  const [row] = await db
    .select({ timeZone: member.timeZone })
    .from(member)
    .where(eq(member.id, memberId));
  return localIsoDate(now, effectiveTimeZone(row?.timeZone));
}
