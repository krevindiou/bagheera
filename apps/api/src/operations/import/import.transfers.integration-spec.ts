import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, asc, eq } from 'drizzle-orm';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { operation, securityEvent } from '../../db/schema';
import { PAYMENT_METHOD_ID } from '../../db/seed-data';
import { seedSignedInMember, type SignedInFixture } from '../../test-support/auth-fixture';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import { ofxFile, type TestTransaction } from '../../test-support/ofx-files';
import {
  FILE,
  NO_CHANGES,
  type Preview,
  confirmImport,
  createAccount,
  startImport,
} from '../../test-support/import-fixtures';

describe('bank file import: transfers', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  const operationsOf = (accountId: string) =>
    getDb(app)
      .select()
      .from(operation)
      .where(eq(operation.accountId, accountId))
      .orderBy(asc(operation.valueDate));

  describe('POST /operations/import/:importId/preview', () => {
    describe('transfer counterpart accounts', () => {
      const FILE_OF_TRANSFERS = [
        'Date;Amount;Label;Type',
        '05/03/2026;-40,00;Savings top-up;XFER',
        '06/03/2026;25,00;From savings;XFER',
        '07/03/2026;-3,00;Coffee;POS',
      ].join('\n');

      const setup = async (content = FILE_OF_TRANSFERS) => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const otherId = await createAccount(fixture);
        const { importId } = await startImport(fixture, accountId, content);
        return { fixture, accountId, otherId, importId };
      };
      const send = (
        fixture: SignedInFixture,
        importId: string,
        action: 'preview' | 'confirm',
        transferAccountChanges: object[],
      ) =>
        action === 'confirm'
          ? confirmImport(fixture, importId, { transferAccountChanges })
          : fixture.mutate('post', `/operations/import/${importId}/${action}`, {
              transferAccountChanges,
            });

      it('shows the account chosen for a transfer row, and none for the others', async () => {
        const { fixture, otherId, importId } = await setup();
        const res = await send(fixture, importId, 'preview', [
          { line: 1, accountId: otherId },
          { line: 3, accountId: otherId },
        ]);
        expect(res.status).toBe(200);
        expect((res.body as Preview).rows.map((row) => row.transferAccountId)).toEqual([
          otherId,
          null,
          null,
        ]);
      });

      describe('suggested from earlier transfers', () => {
        const transferTo = (
          fixture: SignedInFixture,
          from: string,
          to: string,
          thirdParty = 'Savings top-up',
        ) =>
          fixture.mutate('post', '/operations', {
            accountId: from,
            type: 'debit',
            thirdParty,
            amount: 10,
            paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
            transferAccountId: to,
            valueDate: '2026-01-10',
          });

        it('suggests the account of an earlier transfer of the same third party', async () => {
          const { fixture, accountId, otherId, importId } = await setup();
          await transferTo(fixture, accountId, otherId);

          const res = await send(fixture, importId, 'preview', []);

          expect(
            (res.body as Preview).rows.map((row) => [
              row.transferAccountId,
              row.transferAccountOrigin,
            ]),
          ).toEqual([
            [otherId, 'history'],
            [null, null],
            [null, null],
          ]);
        });

        it('records the suggested transfer, and an external one when the Member chose that', async () => {
          const first = await setup();
          await transferTo(first.fixture, first.accountId, first.otherId);
          const suggested = await send(first.fixture, first.importId, 'confirm', []);
          expect(suggested.status).toBe(200);
          expect(await operationsOf(first.otherId)).toHaveLength(2);

          const second = await setup();
          await transferTo(second.fixture, second.accountId, second.otherId);
          const external = await send(second.fixture, second.importId, 'confirm', [
            { line: 1, accountId: null },
          ]);
          expect(external.status).toBe(200);
          expect(await operationsOf(second.otherId)).toHaveLength(1);
        });

        it('learns only from the account imported into', async () => {
          const { fixture, otherId, importId } = await setup();
          const third = await createAccount(fixture);
          await transferTo(fixture, otherId, third);

          const res = await send(fixture, importId, 'preview', []);

          expect((res.body as Preview).rows[0].transferAccountId).toBeNull();
        });

        it('does not suggest an account that is closed now', async () => {
          const { fixture, accountId, importId } = await setup();
          const closed = await createAccount(fixture);
          await transferTo(fixture, accountId, closed);
          await fixture.mutate('post', `/accounts/${closed}/close`);

          const res = await send(fixture, importId, 'preview', []);

          expect(res.status).toBe(200);
          expect((res.body as Preview).rows[0].transferAccountId).toBeNull();
        });
      });

      it('records each chosen transfer with its mirror in the other account', async () => {
        const { fixture, accountId, otherId, importId } = await setup();
        const res = await send(fixture, importId, 'confirm', [
          { line: 1, accountId: otherId },
          { line: 2, accountId: otherId },
        ]);
        expect(res.status).toBe(200);

        const imported = await operationsOf(accountId);
        const mirrors = await operationsOf(otherId);
        expect(imported).toHaveLength(3);
        expect(mirrors).toHaveLength(2);

        const out = imported.find((op) => op.thirdParty === 'Savings top-up');
        const outMirror = mirrors.find((op) => op.valueDate === '2026-03-05');
        expect(out).toMatchObject({
          transferAccountId: otherId,
          paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
          transferOperationId: outMirror?.id,
        });
        expect(outMirror).toMatchObject({
          accountId: otherId,
          transferAccountId: accountId,
          transferOperationId: out?.id,
          paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_CREDIT,
          thirdParty: 'Savings top-up',
          debit: null,
          credit: out?.debit,
          reconciled: false,
          sourceLabel: null,
          bankReference: null,
        });

        const inbound = imported.find((op) => op.thirdParty === 'From savings');
        expect(inbound).toMatchObject({
          paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_CREDIT,
          transferAccountId: otherId,
        });
        expect(mirrors.find((op) => op.valueDate === '2026-03-06')).toMatchObject({
          paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
          debit: inbound?.credit,
          credit: null,
        });
        expect(imported.find((op) => op.thirdParty === 'Coffee')?.transferAccountId).toBeNull();

        const [event] = await getDb(app)
          .select()
          .from(securityEvent)
          .where(
            and(
              eq(securityEvent.eventType, 'operations_imported'),
              eq(securityEvent.memberId, fixture.memberId),
            ),
          );
        expect(event.details).toMatchObject({ accountId, imported: 3, mirrored: 2 });
      });

      it('confirms a file of 5,000 transfers with their mirrors within 10 seconds (NFR-025)', async () => {
        const lines = Array.from(
          { length: IMPORT_LIMITS.MAX_ROWS },
          (_, i) =>
            `${String((i % 28) + 1).padStart(2, '0')}/03/2026;-${i + 1},25;Savings;XFER;T${i}`,
        );
        const { fixture, accountId, otherId, importId } = await setup(
          ['d;a;l;t;r', ...lines].join('\n'),
        );
        await fixture.mutate('post', '/operations', {
          accountId,
          type: 'debit',
          thirdParty: 'Savings',
          amount: 10,
          paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
          transferAccountId: otherId,
          valueDate: '2026-01-10',
        });

        const { revision } = (
          await fixture.mutate('post', `/operations/import/${importId}/preview`, NO_CHANGES)
        ).body as Preview;
        const started = performance.now();
        const res = await fixture.mutate('post', `/operations/import/${importId}/confirm`, {
          revision,
        });
        const elapsed = performance.now() - started;

        expect(res.status).toBe(200);
        expect(elapsed).toBeLessThan(10_000);
        const source = await operationsOf(accountId);
        const mirror = await operationsOf(otherId);
        expect(source).toHaveLength(IMPORT_LIMITS.MAX_ROWS + 1);
        expect(mirror).toHaveLength(IMPORT_LIMITS.MAX_ROWS + 1);
        expect(source.every((op) => op.transferOperationId !== null)).toBe(true);
        const mirrorIds = new Set(mirror.map((op) => op.id));
        expect(source.every((op) => mirrorIds.has(op.transferOperationId as string))).toBe(true);
        expect(mirror.every((op) => op.reconciled === false && op.bankReference === null)).toBe(
          true,
        );
      }, 60_000);

      it('records an external transfer when no account is chosen', async () => {
        const { fixture, accountId, otherId, importId } = await setup();
        const res = await send(fixture, importId, 'confirm', [{ line: 1, accountId: null }]);
        expect(res.status).toBe(200);
        expect(await operationsOf(accountId)).toHaveLength(3);
        expect(await operationsOf(otherId)).toHaveLength(0);
      });

      it('discards the account chosen for a row whose method is not a transfer', async () => {
        const { fixture, accountId, otherId, importId } = await setup();
        const res = await confirmImport(fixture, importId, {
          paymentMethodChanges: [{ line: 1, paymentMethodId: PAYMENT_METHOD_ID.DIRECT_DEBIT }],
          transferAccountChanges: [{ line: 1, accountId: otherId }],
        });
        expect(res.status).toBe(200);
        expect(await operationsOf(accountId)).toHaveLength(3);
        expect(await operationsOf(otherId)).toHaveLength(0);
      });

      it('creates no mirror for a skipped row, until it is included', async () => {
        const { fixture, accountId, otherId, importId } = await setup();
        await fixture.mutate('post', '/operations', {
          accountId,
          type: 'debit',
          thirdParty: 'Savings top-up',
          amount: 40,
          paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
          valueDate: '2026-03-05',
        });
        const change = [{ line: 1, accountId: otherId }];

        const first = await send(fixture, importId, 'confirm', change);
        expect(first.status).toBe(200);
        expect(await operationsOf(otherId)).toHaveLength(0);

        const again = await startImport(fixture, accountId, FILE_OF_TRANSFERS);
        const res = await confirmImport(fixture, again.importId, {
          includedLines: [1],
          transferAccountChanges: change,
        });
        expect(res.status).toBe(200);
        expect(await operationsOf(otherId)).toHaveLength(1);
      });

      it.each([
        ['the account imported into', 'transfer_same_account'],
        ['an account of another member', 'transfer_account_invalid'],
        ['a closed account', 'transfer_account_not_active'],
        ['an account in another currency', 'transfer_currency_mismatch'],
      ])('refuses %s', async (_name, code) => {
        const { fixture, accountId, importId } = await setup();
        let accountIdChosen = accountId;
        if (code === 'transfer_account_invalid') {
          const stranger = await seedSignedInMember(app);
          accountIdChosen = await createAccount(stranger);
        } else if (code === 'transfer_account_not_active') {
          accountIdChosen = await createAccount(fixture);
          await fixture.mutate('post', `/accounts/${accountIdChosen}/close`);
        } else if (code === 'transfer_currency_mismatch') {
          const bank = await fixture.mutate('post', '/banks/choice', { name: 'Dollar bank' });
          const created = await fixture.mutate('post', '/accounts', {
            bankId: (bank.body as { id: string }).id,
            name: 'Dollars',
            currency: 'USD',
            initialBalance: 0,
          });
          accountIdChosen = (created.body as { account: { id: string } }).account.id;
        }

        for (const action of ['preview', 'confirm'] as const) {
          const res = await send(fixture, importId, action, [
            { line: 1, accountId: accountIdChosen },
          ]);
          expect(res.status).toBe(400);
          expect(res.body).toMatchObject({ code });
        }
        expect(await operationsOf(accountId)).toHaveLength(0);
      });

      it('refuses a malformed or repeated pick, and ignores a line that is no readable row', async () => {
        const { fixture, otherId, importId } = await setup();
        expect(
          (await send(fixture, importId, 'preview', [{ line: 99, accountId: otherId }])).status,
        ).toBe(200);
        for (const changes of [
          [{ line: 0, accountId: otherId }],
          [{ line: 1, accountId: 'x' }],
          [{ line: 1 }],
          [
            { line: 1, accountId: otherId },
            { line: 1, accountId: null },
          ],
        ]) {
          expect((await send(fixture, importId, 'preview', changes)).status).toBe(400);
        }
      });
    });

    it("answers not found for another member's import", async () => {
      const owner = await seedSignedInMember(app);
      const accountId = await createAccount(owner);
      const { importId } = await startImport(owner, accountId, FILE);
      const other = await seedSignedInMember(app);
      const res = await other.mutate('post', `/operations/import/${importId}/preview`, NO_CHANGES);
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ code: 'import_not_found' });
    });
  });

  describe('both sides of a transfer', () => {
    const debitSide: TestTransaction = {
      date: '20260305',
      amount: '-100.00',
      name: 'VIR LIVRET A',
      type: 'XFER',
      reference: 'CUR-1',
    };
    // The other bank posts it two days later under its own words.
    const creditSide: TestTransaction = {
      date: '20260307',
      amount: '100.00',
      name: 'VIR DE COMPTE COURANT',
      type: 'XFER',
      reference: 'SAV-1',
    };

    // The two accounts are at different banks, so their files name different ones.
    const SAVINGS_FILE = { accountId: 'SAVINGS-0001' };

    async function firstSideImported() {
      const fixture = await seedSignedInMember(app);
      const current = await createAccount(fixture);
      const savings = await createAccount(fixture);
      const first = await startImport(fixture, current, ofxFile([debitSide]));
      const done = await confirmImport(fixture, first.importId, {
        transferAccountChanges: [{ line: 1, accountId: savings }],
      });
      expect(done.status).toBe(200);
      const second = await startImport(fixture, savings, ofxFile([creditSide], SAVINGS_FILE));
      return { fixture, current, savings, importId: second.importId };
    }
    const operationsIn = (accountId: string) =>
      getDb(app).select().from(operation).where(eq(operation.accountId, accountId));
    const previewOf = async (fixture: SignedInFixture, importId: string) =>
      (await fixture.mutate('post', `/operations/import/${importId}/preview`, {})).body as Preview;

    it('creates the other side unreconciled with the first file', async () => {
      const { savings } = await firstSideImported();
      const [mirror] = await operationsIn(savings);
      expect(mirror).toMatchObject({ reconciled: false, sourceLabel: null, bankReference: null });
    });

    it('recognises the row of the second file as that other side', async () => {
      const { fixture, importId } = await firstSideImported();

      const preview = await previewOf(fixture, importId);

      expect(preview.skippedCount).toBe(1);
      expect(preview.rows[0]).toMatchObject({
        status: 'skipped',
        recorded: { matchedBy: 'transfer', reconciled: false, valueDate: '2026-03-05' },
      });
    });

    it('shows the row as imported once its payment method is no longer a transfer one', async () => {
      const { fixture, importId } = await firstSideImported();

      const preview = (
        await fixture.mutate('post', `/operations/import/${importId}/preview`, {
          paymentMethodChanges: [{ line: 1, paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT }],
        })
      ).body as Preview;

      expect(preview.rows[0]).toMatchObject({ status: 'import', recorded: null });
    });

    it('refuses a confirmation whose payment method pick moves a row the preview skipped', async () => {
      const { fixture, savings, importId } = await firstSideImported();
      const shown = await previewOf(fixture, importId);
      expect(shown.rows[0]).toMatchObject({ status: 'skipped' });

      const res = await fixture.mutate('post', `/operations/import/${importId}/confirm`, {
        revision: shown.revision,
        paymentMethodChanges: [{ line: 1, paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT }],
      });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'import_preview_stale' });
      expect(await operationsIn(savings)).toHaveLength(1);
    });

    it('creates no second operation, and reconciles the other side when asked', async () => {
      const { fixture, savings, importId } = await firstSideImported();

      const res = await confirmImport(fixture, importId, {
        reconcileLines: [1],
      });

      expect(res.body).toMatchObject({ importedCount: 0, reconciledCount: 1 });
      const operations = await operationsIn(savings);
      expect(operations).toHaveLength(1);
      expect(operations[0]).toMatchObject({
        reconciled: true,
        bankReference: 'SAV-1',
        sourceLabel: 'VIR DE COMPTE COURANT',
        valueDate: '2026-03-05',
      });
    });

    it('gives each other side the reference and label of its own row when several are reconciled', async () => {
      const fixture = await seedSignedInMember(app);
      const current = await createAccount(fixture);
      const savings = await createAccount(fixture);
      const second: TestTransaction = {
        ...debitSide,
        date: '20260306',
        amount: '-40.00',
        name: 'VIR LIVRET B',
        reference: 'CUR-2',
      };
      const first = await startImport(fixture, current, ofxFile([debitSide, second]));
      await confirmImport(fixture, first.importId, {
        transferAccountChanges: [
          { line: 1, accountId: savings },
          { line: 2, accountId: savings },
        ],
      });
      const before = await operationsIn(savings);
      const sides: TestTransaction[] = [
        creditSide,
        {
          ...creditSide,
          date: '20260308',
          amount: '40.00',
          name: 'VIR SECOND',
          reference: 'SAV-2',
        },
      ];
      const next = await startImport(fixture, savings, ofxFile(sides, SAVINGS_FILE));

      const res = await confirmImport(fixture, next.importId, { reconcileLines: [1, 2] });

      expect(res.body).toMatchObject({ importedCount: 0, reconciledCount: 2 });
      const after = await operationsIn(savings);
      expect(
        after.map((op) => [op.credit, op.bankReference, op.sourceLabel, op.reconciled]),
      ).toEqual(
        expect.arrayContaining([
          [1000000, 'SAV-1', 'VIR DE COMPTE COURANT', true],
          [400000, 'SAV-2', 'VIR SECOND', true],
        ]),
      );
      for (const op of after) {
        const earlier = before.find((b) => b.id === op.id);
        expect(op.updatedAt.getTime()).toBeGreaterThan(earlier!.updatedAt.getTime());
      }
    });

    it('leaves the other side as it is when the Member does not reconcile it', async () => {
      const { fixture, savings, importId } = await firstSideImported();

      const res = await confirmImport(fixture, importId, {
        reconcileLines: [],
      });

      expect(res.body).toMatchObject({ importedCount: 0, skippedCount: 1, reconciledCount: 0 });
      expect(await operationsIn(savings)).toEqual([
        expect.objectContaining({ reconciled: false, bankReference: null, sourceLabel: null }),
      ]);
    });

    it('finds it by its bank reference the next time, whatever it became', async () => {
      const { fixture, savings, importId } = await firstSideImported();
      await confirmImport(fixture, importId, {
        reconcileLines: [1],
      });
      await getDb(app)
        .update(operation)
        .set({ thirdParty: 'Renamed', valueDate: '2026-03-25' })
        .where(eq(operation.accountId, savings));

      const again = await startImport(fixture, savings, ofxFile([creditSide], SAVINGS_FILE));

      expect((await previewOf(fixture, again.importId)).rows[0]).toMatchObject({
        status: 'skipped',
        recorded: { matchedBy: 'reference', reconciled: true },
      });
    });

    it('imports the row anyway when the Member decides it is another transfer', async () => {
      const { fixture, savings, importId } = await firstSideImported();

      const res = await confirmImport(fixture, importId, {
        includedLines: [1],
        reconcileLines: [1],
      });

      expect(res.body).toMatchObject({ importedCount: 1, reconciledCount: 0 });
      expect(await operationsIn(savings)).toHaveLength(2);
    });

    it('does not take a transfer of another amount or a week away', async () => {
      const { fixture, savings } = await firstSideImported();
      const file = ofxFile(
        [
          { ...creditSide, amount: '100.50', reference: 'SAV-2' },
          { ...creditSide, date: '20260315', reference: 'SAV-3' },
        ],
        SAVINGS_FILE,
      );
      const { importId } = await startImport(fixture, savings, file);

      const preview = await previewOf(fixture, importId);

      expect(preview.rows.map((row) => row.status)).toEqual(['import', 'import']);
    });
  });
});
