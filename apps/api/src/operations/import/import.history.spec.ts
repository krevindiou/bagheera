import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { BusinessError } from '../../common/filters/business-error';
import { ImportHistory } from './import.history';
import type { RowOutcome } from './rows/types';

describe('ImportHistory.recordedAround', () => {
  const row: RowOutcome = {
    status: 'import',
    line: 1,
    valueDate: '2026-03-05',
    type: 'debit',
    amount: 1000,
    thirdParty: 'Bakery',
    notes: '',
    paymentMethodId: 'pm-1',
    paymentMethodOrigin: null,
    categoryId: null,
    categoryOrigin: null,
    transferAccountId: null,
    transferAccountOrigin: null,
    sourceLabel: 'BAKERY',
    labelOrigin: 'file',
    bankReference: 'R1',
    recorded: null,
  };

  function executorFound(count: number) {
    const limit = vi.fn().mockResolvedValue(Array.from({ length: count }, (_, i) => ({ id: i })));
    const select = vi.fn().mockReturnValue({
      from: () => ({ where: () => ({ orderBy: () => ({ limit }) }) }),
    });
    return { executor: { select } as unknown as NodePgDatabase, select, limit };
  }

  const history = new ImportHistory({} as NodePgDatabase);

  it('reads one operation past the cap, and returns those found up to it', async () => {
    const { executor, limit } = executorFound(IMPORT_LIMITS.MAX_RECORDED_OPERATIONS);
    const found = await history.recordedAround('acc-1', [row], executor);
    expect(found).toHaveLength(IMPORT_LIMITS.MAX_RECORDED_OPERATIONS);
    expect(limit).toHaveBeenCalledWith(IMPORT_LIMITS.MAX_RECORDED_OPERATIONS + 1);
  });

  it('refuses the import when the rows reach more operations than the cap', async () => {
    const { executor } = executorFound(IMPORT_LIMITS.MAX_RECORDED_OPERATIONS + 1);
    const refused = history.recordedAround('acc-1', [row], executor);
    await expect(refused).rejects.toBeInstanceOf(BusinessError);
    await expect(refused).rejects.toMatchObject({
      status: 422,
      response: {
        code: 'import_too_many_recorded',
        params: { limit: IMPORT_LIMITS.MAX_RECORDED_OPERATIONS },
      },
    });
  });

  it('reads nothing for a file of invalid rows only', async () => {
    const { executor, select } = executorFound(0);
    const invalid: RowOutcome = {
      status: 'invalid',
      line: 1,
      reason: 'date_invalid',
      sourceLabel: null,
    };
    expect(await history.recordedAround('acc-1', [invalid], executor)).toEqual([]);
    expect(select).not.toHaveBeenCalled();
  });
});
