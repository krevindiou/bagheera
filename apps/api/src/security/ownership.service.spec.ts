import { UnauthorizedException } from '@nestjs/common';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { vi } from 'vitest';
import type { Executor } from '../db/executor';
import type { MemberId } from './ids';
import { MEMBER_QUOTAS } from './member-quotas';
import { OwnershipService } from './ownership.service';

describe('OwnershipService.requireBelowQuotaLocked', () => {
  const memberId = 'm1' as MemberId;

  // The member select's chain, resolving to `rows` at its final `.for()`.
  function setup(rows: unknown[], held: number) {
    const calls: string[] = [];
    const forLock = vi.fn().mockImplementation(() => {
      calls.push('lock');
      return Promise.resolve(rows);
    });
    const tx = {
      select: () => ({ from: () => ({ where: () => ({ for: forLock }) }) }),
    } as unknown as Executor;
    const ownership = new OwnershipService({} as NodePgDatabase);
    const countOwned = vi.spyOn(ownership, 'countOwned').mockImplementation(() => {
      calls.push('count');
      return Promise.resolve(held);
    });
    return { tx, ownership, forLock, countOwned, calls };
  }

  it('locks the member row for update, then counts, and lets a create through below quota', async () => {
    const { tx, ownership, forLock, countOwned, calls } = setup(
      [{ id: memberId }],
      MEMBER_QUOTAS.banks - 1,
    );
    await expect(ownership.requireBelowQuotaLocked(tx, 'banks', memberId)).resolves.toBeUndefined();
    expect(forLock).toHaveBeenCalledWith('update');
    expect(countOwned).toHaveBeenCalledWith('banks', memberId);
    expect(calls).toEqual(['lock', 'count']);
  });

  it('refuses a create once the member holds the quota', async () => {
    const { tx, ownership } = setup([{ id: memberId }], MEMBER_QUOTAS.reports);
    await expect(ownership.requireBelowQuotaLocked(tx, 'reports', memberId)).rejects.toMatchObject({
      response: {
        code: 'quota_exceeded',
        params: { limit: MEMBER_QUOTAS.reports, kind: 'reports' },
      },
    });
  });

  it('treats a missing member as signed out, without counting', async () => {
    const { tx, ownership, countOwned } = setup([], 0);
    await expect(
      ownership.requireBelowQuotaLocked(tx, 'accounts', memberId),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(countOwned).not.toHaveBeenCalled();
  });
});
