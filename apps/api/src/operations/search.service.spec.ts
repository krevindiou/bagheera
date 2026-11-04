import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type IORedis from 'ioredis';
import { vi } from 'vitest';
import type { MemberId } from '../security/ids';
import type { OwnershipService } from '../security/ownership.service';
import { OperationSearchService } from './search.service';

function setup(queryError?: Error) {
  const rows = queryError ? Promise.reject(queryError) : Promise.resolve([]);
  // Swallow the rejection until the service awaits it.
  rows.catch(() => undefined);
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnValue(rows),
    then: undefined,
  };
  const db = { select: vi.fn().mockReturnValue(chain) };
  const valkey = { set: vi.fn().mockResolvedValue('OK') };
  const ownership = { requireOwnedAccount: vi.fn().mockResolvedValue(undefined) };
  const service = new OperationSearchService(
    db as unknown as NodePgDatabase,
    valkey as unknown as IORedis,
    ownership as unknown as OwnershipService,
  );
  return { service, valkey };
}

describe('OperationSearchService.search', () => {
  const memberId = 'member-1' as MemberId;

  it('never remembers criteria whose query fails', async () => {
    const { service, valkey } = setup(new Error('Failed query'));

    await expect(service.search(memberId, { accountId: 'acc-1', notes: 'x' }, 1)).rejects.toThrow(
      'Failed query',
    );
    expect(valkey.set).not.toHaveBeenCalled();
  });
});
