import { UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { vi } from 'vitest';
import type { Executor } from '../db/executor';
import { keepThroughBump, lockMemberAtSessionEpoch, sessionEpochOf } from './session-epoch';

function session(data: Record<string, unknown>): Request['session'] {
  return data as unknown as Request['session'];
}

describe('sessionEpochOf', () => {
  it('reads the stored epoch, counting a missing one as 0', () => {
    expect(sessionEpochOf(session({ sessionEpoch: 4 }))).toBe(4);
    expect(sessionEpochOf(session({}))).toBe(0);
  });
});

// A transaction whose locked member read returns `rows`.
function txReturning(rows: unknown[]) {
  const forUpdate = vi.fn().mockResolvedValue(rows);
  const tx = {
    select: () => ({ from: () => ({ where: () => ({ for: forUpdate }) }) }),
  } as unknown as Executor;
  return { tx, forUpdate };
}

describe('lockMemberAtSessionEpoch', () => {
  it('returns the locked member row while the session is on its epoch', async () => {
    const row = { id: 'm1', sessionEpoch: 2 };
    const { tx, forUpdate } = txReturning([row]);

    await expect(
      lockMemberAtSessionEpoch(tx, 'm1', session({ memberId: 'm1', sessionEpoch: 2 })),
    ).resolves.toBe(row);
    expect(forUpdate).toHaveBeenCalledWith('update');
  });

  it('counts a session without an epoch as 0', async () => {
    const { tx } = txReturning([{ id: 'm1', sessionEpoch: 0 }]);

    await expect(
      lockMemberAtSessionEpoch(tx, 'm1', session({ memberId: 'm1' })),
    ).resolves.toBeDefined();
  });

  it('refuses a session a later bump ended, or a member that is gone', async () => {
    const behind = txReturning([{ id: 'm1', sessionEpoch: 3 }]).tx;
    await expect(
      lockMemberAtSessionEpoch(behind, 'm1', session({ memberId: 'm1', sessionEpoch: 2 })),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    const gone = txReturning([]).tx;
    await expect(
      lockMemberAtSessionEpoch(gone, 'm1', session({ memberId: 'm1' })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

describe('keepThroughBump', () => {
  it("moves the member's session from the epoch just before the bump onto the new one", () => {
    const s = session({ memberId: 'm1', sessionEpoch: 2 });
    expect(keepThroughBump(s, 'm1', 3)).toBe(true);
    expect(s.sessionEpoch).toBe(3);
  });

  it('moves a session without an epoch when the bump is the first', () => {
    const s = session({ memberId: 'm1' });
    expect(keepThroughBump(s, 'm1', 1)).toBe(true);
    expect(s.sessionEpoch).toBe(1);
  });

  it('leaves a session already ended by an earlier bump where it is', () => {
    const s = session({ memberId: 'm1', sessionEpoch: 1 });
    expect(keepThroughBump(s, 'm1', 3)).toBe(false);
    expect(s.sessionEpoch).toBe(1);
  });

  it("leaves another member's session, or none at all, alone", () => {
    const other = session({ memberId: 'm2', sessionEpoch: 0 });
    expect(keepThroughBump(other, 'm1', 1)).toBe(false);
    expect(other.sessionEpoch).toBe(0);
    expect(keepThroughBump(session({}), 'm1', 1)).toBe(false);
    expect(keepThroughBump(undefined, 'm1', 1)).toBe(false);
  });
});
