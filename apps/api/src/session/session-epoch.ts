import { UnauthorizedException } from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import type { Request } from 'express';
import type { Executor } from '../db/executor';
import { member } from '../db/schema';
import './session-data';

export function sessionEpochOf(session: Request['session']): number {
  return session.sessionEpoch ?? 0;
}

/** `member.sessionEpoch`'s new value, set in the same transaction as the change. */
export const bumpedSessionEpoch = sql<number>`${member.sessionEpoch} + 1`;

/**
 * Locks the member row inside `tx` and re-checks the requesting session is
 * on the member's current epoch. The guard only checked it at request
 * start; the lock queues this write behind any bump, so a write from a
 * session that bump ended is refused rather than landing after it.
 */
export async function lockMemberAtSessionEpoch(
  tx: Executor,
  memberId: string,
  session: Request['session'],
): Promise<typeof member.$inferSelect> {
  const [row] = await tx.select().from(member).where(eq(member.id, memberId)).for('update');
  if (!row || row.sessionEpoch !== sessionEpochOf(session)) {
    throw new UnauthorizedException();
  }
  return row;
}

/**
 * Moves the session making a change onto the epoch that change bumped the
 * member to, so it stays signed in while the others end. Only a session of
 * that member that was current right before the bump moves: an older one
 * must not be revived. Returns whether it moved.
 */
export function keepThroughBump(
  session: Request['session'] | undefined,
  memberId: string,
  newEpoch: number,
): boolean {
  if (!session || session.memberId !== memberId || sessionEpochOf(session) !== newEpoch - 1) {
    return false;
  }
  session.sessionEpoch = newEpoch;
  return true;
}
