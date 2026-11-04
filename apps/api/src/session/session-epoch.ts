import { sql } from 'drizzle-orm';
import type { Request } from 'express';
import { member } from '../db/schema';
import './session-data';

export function sessionEpochOf(session: Request['session']): number {
  return session.sessionEpoch ?? 0;
}

/** `member.sessionEpoch`'s new value, set in the same transaction as the change. */
export const bumpedSessionEpoch = sql<number>`${member.sessionEpoch} + 1`;

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
