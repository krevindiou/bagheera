import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { BusinessError } from '../../common/filters/business-error';
import type { MemberId } from '../../security/ids';
import type { TransferService } from '../transfer.service';
import type { ImportHistory } from './import.history';
import { ImportPicks } from './import.picks';
import type { ParsedRow, RowOutcome } from './rows/types';

describe('ImportPicks', () => {
  const memberId = 'm1' as MemberId;
  const db = {} as NodePgDatabase;
  const into = { id: 'acc-1', currency: 'EUR' };

  const row = (overrides: Partial<ParsedRow> = {}): RowOutcome => ({
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
    bankReference: null,
    recorded: null,
    ...overrides,
  });
  const invalid = (line: number): RowOutcome => ({
    status: 'invalid',
    line,
    reason: 'date_invalid',
    sourceLabel: null,
  });

  const history = {
    paymentMethodTypes: vi.fn(),
    categoryTypes: vi.fn(),
  };
  const transfers = { requireEligibleTarget: vi.fn() };
  const picks = new ImportPicks(
    db,
    history as unknown as ImportHistory,
    transfers as unknown as TransferService,
  );

  beforeEach(() => {
    vi.resetAllMocks();
    history.paymentMethodTypes.mockResolvedValue(new Map());
    history.categoryTypes.mockResolvedValue(new Map());
  });

  describe('requireTransferAccounts', () => {
    it('checks each chosen account once, as a target of the account imported into', async () => {
      await picks.requireTransferAccounts(memberId, into, [
        row({ line: 1, transferAccountId: 'acc-2' }),
        row({ line: 2, transferAccountId: 'acc-2' }),
        row({ line: 3, transferAccountId: 'acc-3' }),
        row({ line: 4 }),
        invalid(5),
      ]);

      expect(transfers.requireEligibleTarget).toHaveBeenCalledTimes(2);
      expect(transfers.requireEligibleTarget).toHaveBeenCalledWith(db, 'acc-2', {
        sourceAccountId: 'acc-1',
        sourceCurrency: 'EUR',
        memberId,
      });
      expect(transfers.requireEligibleTarget).toHaveBeenCalledWith(db, 'acc-3', expect.anything());
    });

    it('checks nothing when no row is a transfer', async () => {
      await picks.requireTransferAccounts(memberId, into, [row(), invalid(2)]);

      expect(transfers.requireEligibleTarget).not.toHaveBeenCalled();
    });

    it('lets the refusal of an account through', async () => {
      const refusal = new Error('not eligible');
      transfers.requireEligibleTarget.mockRejectedValueOnce(refusal);

      await expect(
        picks.requireTransferAccounts(memberId, into, [row({ transferAccountId: 'acc-2' })]),
      ).rejects.toBe(refusal);
    });
  });

  describe('requirePicksSuit', () => {
    const codeOf = async (promise: Promise<unknown>) => {
      const error: unknown = await promise.then(
        () => undefined,
        (err: unknown) => err,
      );
      if (!(error instanceof BusinessError)) throw new Error('did not refuse');
      return error.getResponse();
    };

    it('asks the database nothing when there are no picks', async () => {
      await picks.requirePicksSuit([row()], new Map(), new Map());

      expect(history.paymentMethodTypes).not.toHaveBeenCalled();
      expect(history.categoryTypes).not.toHaveBeenCalled();
    });

    it('accepts picks that suit the type of their row', async () => {
      history.paymentMethodTypes.mockResolvedValue(new Map([['pm-2', 'debit']]));
      history.categoryTypes.mockResolvedValue(new Map([['cat-1', 'debit']]));

      await expect(
        picks.requirePicksSuit([row()], new Map([[1, 'pm-2']]), new Map([[1, 'cat-1']])),
      ).resolves.toBeUndefined();
      expect(history.paymentMethodTypes).toHaveBeenCalledWith(['pm-2']);
      expect(history.categoryTypes).toHaveBeenCalledWith(['cat-1']);
    });

    it('asks for each method and category once', async () => {
      history.paymentMethodTypes.mockResolvedValue(new Map([['pm-2', 'debit']]));
      history.categoryTypes.mockResolvedValue(new Map([['cat-1', 'debit']]));

      await picks.requirePicksSuit(
        [row({ line: 1 }), row({ line: 2 })],
        new Map([
          [1, 'pm-2'],
          [2, 'pm-2'],
        ]),
        new Map<number, string | null>([
          [1, 'cat-1'],
          [2, 'cat-1'],
        ]),
      );

      expect(history.paymentMethodTypes).toHaveBeenCalledWith(['pm-2']);
      expect(history.categoryTypes).toHaveBeenCalledWith(['cat-1']);
    });

    it('refuses a payment method of the other type', async () => {
      history.paymentMethodTypes.mockResolvedValue(new Map([['pm-2', 'credit']]));

      expect(
        await codeOf(picks.requirePicksSuit([row()], new Map([[1, 'pm-2']]), new Map())),
      ).toMatchObject({ code: 'payment_method_invalid' });
    });

    it('refuses a payment method that does not exist', async () => {
      expect(
        await codeOf(picks.requirePicksSuit([row()], new Map([[1, 'nope']]), new Map())),
      ).toMatchObject({ code: 'payment_method_invalid' });
    });

    it('refuses a category of the other type', async () => {
      history.categoryTypes.mockResolvedValue(new Map([['cat-1', 'credit']]));

      expect(
        await codeOf(picks.requirePicksSuit([row()], new Map(), new Map([[1, 'cat-1']]))),
      ).toMatchObject({ code: 'category_invalid' });
    });

    it('lets a row go without a category', async () => {
      await expect(
        picks.requirePicksSuit([row()], new Map(), new Map([[1, null]])),
      ).resolves.toBeUndefined();
      expect(history.categoryTypes).not.toHaveBeenCalled();
    });

    it('ignores a pick for a line that is no readable row', async () => {
      await expect(
        picks.requirePicksSuit(
          [invalid(1)],
          new Map([[1, 'pm-2']]),
          new Map([
            [1, 'cat-1'],
            [9, 'cat-1'],
          ]),
        ),
      ).resolves.toBeUndefined();
    });
  });
});
