import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { asc, eq } from 'drizzle-orm';
import { operation } from '../../db/schema';
import { PAYMENT_METHOD_ID } from '../../db/seed-data';
import { seedSignedInMember, type SignedInFixture } from '../../test-support/auth-fixture';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import { ofxFile, type TestTransaction } from '../../test-support/ofx-files';
import {
  NO_CHANGES,
  type Preview,
  confirmImport,
  createAccount,
  startImport,
} from '../../test-support/import-fixtures';

describe('bank file import: matching and reconciliation', () => {
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

  describe('bank reference', () => {
    const confirm = (fixture: SignedInFixture, importId: string) =>
      confirmImport(fixture, importId, NO_CHANGES);

    it('is stored with the operation when the bank gives one of at most 255 characters', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(
        fixture,
        accountId,
        [
          'd;a;l;t;r',
          '05/03/2026;-1;A;;REF-1',
          '06/03/2026;-1;B;;',
          `07/03/2026;-1;C;;${'r'.repeat(255)}`,
          `08/03/2026;-1;D;;${'r'.repeat(256)}`,
        ].join('\n'),
      );
      await confirm(fixture, importId);

      expect((await operationsOf(accountId)).map((op) => op.bankReference)).toEqual([
        'REF-1',
        null,
        'r'.repeat(255),
        null,
      ]);
    });

    it('skips a row again whatever its operation became since', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const content = 'd;a;l;t;r\n05/03/2026;-12,50;Bakery;;REF-1\n';
      const first = await startImport(fixture, accountId, content);
      await confirm(fixture, first.importId);
      await getDb(app)
        .update(operation)
        .set({ thirdParty: 'Renamed', sourceLabel: null, valueDate: '2026-03-20' })
        .where(eq(operation.accountId, accountId));

      const again = await startImport(fixture, accountId, content);
      const res = await confirm(fixture, again.importId);

      expect(res.body).toMatchObject({ importedCount: 0, skippedCount: 1 });
      expect(await operationsOf(accountId)).toHaveLength(1);
    });

    it('imports a row whose reference the bank reused months later', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const first = await startImport(
        fixture,
        accountId,
        'd;a;l;t;r\n05/03/2026;-12,50;Bakery;;REF-1\n',
      );
      await confirm(fixture, first.importId);

      const again = await startImport(
        fixture,
        accountId,
        'd;a;l;t;r\n05/09/2026;-12,50;Garage;;REF-1\n',
      );
      const res = await confirm(fixture, again.importId);

      expect(res.body).toMatchObject({ importedCount: 1, skippedCount: 0 });
      expect(await operationsOf(accountId)).toHaveLength(2);
    });

    it('imports a row whose reference the bank reused for another amount', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const first = await startImport(
        fixture,
        accountId,
        'd;a;l;t;r\n05/03/2026;-12,50;Bakery;;1\n',
      );
      await confirm(fixture, first.importId);

      const again = await startImport(
        fixture,
        accountId,
        'd;a;l;t;r\n05/03/2026;-12,50;Bakery;;1\n12/04/2026;-80;Electricity;;1\n',
      );
      const preview = await fixture.mutate(
        'post',
        `/operations/import/${again.importId}/preview`,
        NO_CHANGES,
      );
      expect((preview.body as Preview).rows.map((row) => [row.line, row.status])).toEqual([
        [1, 'skipped'],
        [2, 'import'],
      ]);

      const res = await confirm(fixture, again.importId);

      expect(res.body).toMatchObject({ importedCount: 1, skippedCount: 1 });
      expect(await operationsOf(accountId)).toHaveLength(2);
    });

    it('gives an operation to the row that matches its reference, not to a row that only matches its label', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const first = await startImport(
        fixture,
        accountId,
        'd;a;l;t;r\n05/03/2026;-2;Coffee;;REF-1\n',
      );
      await confirm(fixture, first.importId);

      const second = await startImport(
        fixture,
        accountId,
        'd;a;l;t;r\n05/03/2026;-2;Coffee;;REF-NEW\n05/03/2026;-2;Coffee;;REF-1\n',
      );
      const preview = await fixture.mutate(
        'post',
        `/operations/import/${second.importId}/preview`,
        NO_CHANGES,
      );

      expect((preview.body as Preview).rows.map((row) => [row.line, row.status])).toEqual([
        [1, 'import'],
        [2, 'skipped'],
      ]);
    });

    it('falls back on date, amount and label for a bank that changes its references', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const first = await startImport(fixture, accountId, 'd;a;l;t;r\n05/03/2026;-2;Coffee;;A\n');
      await confirm(fixture, first.importId);

      const again = await startImport(fixture, accountId, 'd;a;l;t;r\n05/03/2026;-2;Coffee;;B\n');
      const res = await confirm(fixture, again.importId);

      expect(res.body).toMatchObject({ importedCount: 0, skippedCount: 1 });
    });
  });

  describe('reconciliation', () => {
    const rows: TestTransaction[] = [
      { date: '20260305', amount: '-12.50', name: 'Bakery' },
      { date: '20260306', amount: '1250.00', name: 'Employer' },
    ];
    const enter = (fixture: SignedInFixture, accountId: string, overrides: object = {}) =>
      fixture.mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'bakery',
        amount: 12.5,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-03-05',
        ...overrides,
      });
    const confirm = (fixture: SignedInFixture, importId: string, body: object = NO_CHANGES) =>
      confirmImport(fixture, importId, body);
    const flags = async (accountId: string) =>
      (await operationsOf(accountId)).map((op) => [op.thirdParty, op.reconciled]);

    async function recorded(reconciled: boolean) {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await enter(fixture, accountId, { reconciled });
      const { importId } = await startImport(fixture, accountId, ofxFile(rows));
      return { fixture, accountId, importId };
    }

    describe('the operations imported', () => {
      it('are reconciled unless the Member says otherwise', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const { importId } = await startImport(fixture, accountId, ofxFile(rows));

        expect((await confirm(fixture, importId)).status).toBe(200);

        expect(await flags(accountId)).toEqual([
          ['Bakery', true],
          ['Employer', true],
        ]);
      });

      it.each([
        ['not to reconcile', false, false],
        ['to reconcile', true, true],
      ])('follow the choice %s', async (_name, reconcile, expected) => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const { importId } = await startImport(fixture, accountId, ofxFile(rows));

        await confirm(fixture, importId, { reconcile });

        expect((await flags(accountId)).map(([, flag]) => flag)).toEqual([expected, expected]);
      });

      it('count in the reconciled balance only when they are reconciled', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const { importId } = await startImport(fixture, accountId, ofxFile(rows));
        await confirm(fixture, importId);

        const balance = await fixture.agent.get(`/accounts/${accountId}/balance`);

        expect(balance.body).toMatchObject({ balance: 12375000, reconciledBalance: 12375000 });
      });

      it('leave the mirror of a transfer unreconciled', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const other = await createAccount(fixture);
        const { importId } = await startImport(
          fixture,
          accountId,
          ofxFile([{ date: '20260305', amount: '-5.00', name: 'VIR Savings', type: 'XFER' }]),
        );

        await confirm(fixture, importId, {
          transferAccountChanges: [{ line: 1, accountId: other }],
        });

        expect((await operationsOf(accountId)).map((op) => op.reconciled)).toEqual([true]);
        expect((await operationsOf(other)).map((op) => op.reconciled)).toEqual([false]);
      });

      it('refuse a malformed choice', async () => {
        const { fixture, importId } = await recorded(false);
        for (const body of [{ reconcile: 'yes' }, { reconcile: 1 }]) {
          expect((await confirm(fixture, importId, body)).status).toBe(400);
        }
      });
    });

    describe('a recorded operation reconciled instead of imported', () => {
      it('shows whether the matching operation is reconciled', async () => {
        for (const reconciled of [false, true]) {
          const { fixture, importId } = await recorded(reconciled);
          const res = await fixture.mutate('post', `/operations/import/${importId}/preview`, {});
          expect((res.body as Preview).rows[0].recorded?.reconciled).toBe(reconciled);
        }
      });

      it('reconciles the operation of the chosen row, and creates nothing for it', async () => {
        const { fixture, accountId, importId } = await recorded(false);

        const res = await confirm(fixture, importId, { reconcileLines: [1], reconcile: false });

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ importedCount: 1, skippedCount: 1, reconciledCount: 1 });
        expect(await flags(accountId)).toEqual([
          ['bakery', true],
          ['Employer', false],
        ]);
      });

      it('leaves the operation as it is when no line is chosen', async () => {
        const { fixture, accountId, importId } = await recorded(false);

        const res = await confirm(fixture, importId, { reconcile: true });

        expect(res.body).toMatchObject({ reconciledCount: 0 });
        expect((await flags(accountId))[0]).toEqual(['bakery', false]);
      });

      it('changes nothing but the flag', async () => {
        const { fixture, accountId, importId } = await recorded(false);
        const [before] = await operationsOf(accountId);

        await confirm(fixture, importId, { reconcileLines: [1] });

        const [after] = await operationsOf(accountId);
        expect({ ...after, reconciled: false, updatedAt: before.updatedAt }).toEqual(before);
        expect(after.reconciled).toBe(true);
      });

      it('leaves an operation that is reconciled already, and counts none', async () => {
        const { fixture, importId } = await recorded(true);

        const res = await confirm(fixture, importId, { reconcileLines: [1] });

        expect(res.body).toMatchObject({ reconciledCount: 0 });
      });

      it('imports the row instead when the Member includes it anyway', async () => {
        const { fixture, accountId, importId } = await recorded(false);

        const res = await confirm(fixture, importId, {
          includedLines: [1],
          reconcileLines: [1],
        });

        expect(res.body).toMatchObject({ importedCount: 2, reconciledCount: 0 });
        expect((await flags(accountId)).filter(([name]) => name === 'bakery')).toEqual([
          ['bakery', false],
        ]);
        expect(
          (await operationsOf(accountId)).filter((op) => op.sourceLabel === 'Bakery'),
        ).toHaveLength(1);
      });

      it('ignores a line that is not a skipped row', async () => {
        const { fixture, accountId, importId } = await recorded(false);

        const res = await confirm(fixture, importId, { reconcileLines: [2, 99] });

        expect(res.body).toMatchObject({ reconciledCount: 0 });
        expect((await flags(accountId))[0]).toEqual(['bakery', false]);
      });

      it('works when it is all the import does, and answers a second confirmation the same', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await enter(fixture, accountId);
        await enter(fixture, accountId, {
          type: 'credit',
          thirdParty: 'employer',
          amount: 1250,
          paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT,
          valueDate: '2026-03-06',
        });
        const { importId } = await startImport(fixture, accountId, ofxFile(rows));

        const first = await confirm(fixture, importId, { reconcileLines: [1, 2] });
        const again = await confirm(fixture, importId, { reconcileLines: [1, 2] });

        expect(first.status).toBe(200);
        expect(first.body).toMatchObject({
          importedCount: 0,
          skippedCount: 2,
          reconciledCount: 2,
          alreadyImported: false,
        });
        expect(again.body).toMatchObject({ reconciledCount: 2, alreadyImported: true });
        expect((await operationsOf(accountId)).map((op) => op.reconciled)).toEqual([true, true]);
      });

      it('refuses malformed lines', async () => {
        const { fixture, importId } = await recorded(false);
        for (const reconcileLines of [[0], ['x'], [1, 1], 'all']) {
          expect((await confirm(fixture, importId, { reconcileLines })).status).toBe(400);
        }
      });

      it('reconciles nothing of another account that holds the same operation', async () => {
        const { fixture, importId } = await recorded(false);
        const elsewhere = await createAccount(fixture);
        await enter(fixture, elsewhere);

        await confirm(fixture, importId, { reconcileLines: [1] });

        expect((await operationsOf(elsewhere)).map((op) => op.reconciled)).toEqual([false]);
      });
    });
  });
});
