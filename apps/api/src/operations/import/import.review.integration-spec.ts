import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { asc, eq } from 'drizzle-orm';
import { accountStatement, operation } from '../../db/schema';
import { PAYMENT_METHOD_ID } from '../../db/seed-data';
import { seedSignedInMember, type SignedInFixture } from '../../test-support/auth-fixture';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import { TEST_CRYPTO_KEYS } from '../../test-support/test-crypto-service';
import { CryptoService } from '../../security/crypto.service';
import { ofxFile, type TestTransaction } from '../../test-support/ofx-files';
import {
  NO_CHANGES,
  type Preview,
  confirmImport,
  createAccount,
  startImport,
} from '../../test-support/import-fixtures';

describe('bank file import: review aids', () => {
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

  describe('review aids', () => {
    const rows: TestTransaction[] = [
      { date: '20260305', amount: '-12.50', name: 'Bakery' },
      { date: '20260306', amount: '1250.00', name: 'Employer' },
      { date: '20260307', amount: '-3.00', name: 'Coffee' },
    ];
    const previewOf = async (fixture: SignedInFixture, importId: string) => {
      const res = await fixture.mutate(
        'post',
        `/operations/import/${importId}/preview`,
        NO_CHANGES,
      );
      expect(res.status).toBe(200);
      return res.body as Preview;
    };
    const enter = (
      fixture: SignedInFixture,
      accountId: string,
      overrides: Record<string, unknown> = {},
    ) =>
      fixture.mutate('post', '/operations', {
        accountId,
        type: 'credit',
        thirdParty: 'Gift',
        amount: 100,
        paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT,
        valueDate: '2026-03-01',
        ...overrides,
      });
    const confirmAll = async (fixture: SignedInFixture, importId: string) => {
      const res = await confirmImport(fixture, importId, NO_CHANGES);
      expect(res.status).toBe(200);
    };

    describe('statement summary', () => {
      it('gives the period and the totals of the file', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const { importId } = await startImport(fixture, accountId, ofxFile(rows));

        const { statement } = await previewOf(fixture, importId);

        expect(statement).toMatchObject({
          periodStart: '2026-03-05',
          periodEnd: '2026-03-07',
          debitTotal: 15.5,
          creditTotal: 1250,
          closing: null,
        });
      });

      it('compares the closing balance with what the account would hold once imported', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await enter(fixture, accountId);
        // After the statement date: not part of the balance on that date.
        await enter(fixture, accountId, { amount: 500, valueDate: '2026-05-01' });
        const file = ofxFile(rows, { closing: { amount: '1300.00', date: '20260331' } });
        const { importId } = await startImport(fixture, accountId, file);

        const { statement } = await previewOf(fixture, importId);

        expect(statement.closing).toEqual({
          date: '2026-03-31',
          amount: 1300,
          expected: 1334.5,
        });
      });

      it('counts a skipped row once, through the operation it matches', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await enter(fixture, accountId);
        await enter(fixture, accountId, {
          type: 'debit',
          thirdParty: 'Bakery',
          amount: 12.5,
          paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
          valueDate: '2026-03-05',
        });
        const file = ofxFile(rows, { closing: { amount: '1334.50', date: '20260331' } });
        const { importId } = await startImport(fixture, accountId, file);

        const preview = await previewOf(fixture, importId);

        expect(preview.skippedCount).toBe(1);
        expect(preview.statement.closing?.expected).toBe(1334.5);
      });

      it('reads a closing balance of zero as not given when the account holds something else', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await enter(fixture, accountId);
        const file = ofxFile(rows, { closing: { amount: '0.00', date: '20260331' } });
        const { importId } = await startImport(fixture, accountId, file);

        expect((await previewOf(fixture, importId)).statement.closing).toBeNull();
      });

      it('reads a closing balance of zero as given when the account holds zero on that date', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await enter(fixture, accountId);
        // Brings the balance to zero once the rows of the file are recorded.
        await enter(fixture, accountId, {
          type: 'debit',
          thirdParty: 'Rent',
          amount: 1334.5,
          paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
          valueDate: '2026-03-02',
        });
        const file = ofxFile(rows, { closing: { amount: '0.00', date: '20260331' } });
        const { importId } = await startImport(fixture, accountId, file);

        expect((await previewOf(fixture, importId)).statement.closing).toEqual({
          date: '2026-03-31',
          amount: 0,
          expected: 0,
        });
      });

      it('reads a closing balance of zero as not given when the account has no history to compare', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const file = ofxFile(rows, { closing: { amount: '0.00', date: '20260331' } });
        const { importId } = await startImport(fixture, accountId, file);

        expect((await previewOf(fixture, importId)).statement.closing).toBeNull();
      });

      it.each([
        ['has no operation at all', []],
        ['has operations only on the first day of the file or later', ['2026-03-05', '2026-04-01']],
      ])('shows the closing balance alone when the account %s', async (_name, dates) => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        for (const valueDate of dates) await enter(fixture, accountId, { valueDate });
        const file = ofxFile(rows, { closing: { amount: '1300.00', date: '20260331' } });
        const { importId } = await startImport(fixture, accountId, file);

        expect((await previewOf(fixture, importId)).statement.closing).toEqual({
          date: '2026-03-31',
          amount: 1300,
          expected: null,
        });
      });

      it('compares as soon as one operation is dated before the first row', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await enter(fixture, accountId, { valueDate: '2026-03-04' });
        const file = ofxFile(rows, { closing: { amount: '1334.50', date: '20260331' } });
        const { importId } = await startImport(fixture, accountId, file);

        expect((await previewOf(fixture, importId)).statement.closing?.expected).toBe(1334.5);
      });

      it('leaves out a closing balance it cannot read', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const file = ofxFile(rows, { closing: { amount: 'lots', date: '20260331' } });
        const { importId } = await startImport(fixture, accountId, file);

        expect((await previewOf(fixture, importId)).statement.closing).toBeNull();
      });
    });

    describe('statement account', () => {
      const importFrom = async (
        fixture: SignedInFixture,
        accountId: string,
        accountRef: string | null,
        fileRows: TestTransaction[] = rows,
      ) => {
        const { importId } = await startImport(
          fixture,
          accountId,
          ofxFile(fileRows, { accountId: accountRef }),
        );
        return importId;
      };

      it('flags nothing before the account knows which statement it comes from', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const importId = await importFrom(fixture, accountId, 'FR76 0001');

        expect((await previewOf(fixture, importId)).statement).toMatchObject({
          accountCheck: 'unknown',
          otherAccountId: null,
        });
      });

      it('recognises the same statement in a later import, ignoring spaces and case', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await confirmAll(fixture, await importFrom(fixture, accountId, 'FR76 0001'));

        const later = await importFrom(fixture, accountId, 'fr760001');

        expect((await previewOf(fixture, later)).statement.accountCheck).toBe('same');
      });

      it('flags a file that names another account than the one remembered', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await confirmAll(fixture, await importFrom(fixture, accountId, 'FR76 0001'));

        const other = await importFrom(fixture, accountId, 'FR76 0002');

        expect((await previewOf(fixture, other)).statement).toMatchObject({
          accountCheck: 'different',
          otherAccountId: null,
        });
      });

      it('names the account of the Member that the file was imported into before', async () => {
        const fixture = await seedSignedInMember(app);
        const first = await createAccount(fixture);
        const second = await createAccount(fixture);
        await confirmAll(fixture, await importFrom(fixture, first, 'FR76 0001'));

        const importId = await importFrom(fixture, second, 'FR76 0001');

        expect((await previewOf(fixture, importId)).statement).toMatchObject({
          accountCheck: 'elsewhere',
          otherAccountId: first,
        });
      });

      it('flags nothing for a file that names no account', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await confirmAll(fixture, await importFrom(fixture, accountId, 'FR76 0001'));

        const importId = await importFrom(fixture, accountId, null);

        expect((await previewOf(fixture, importId)).statement.accountCheck).toBe('unknown');
      });

      it("never compares with another Member's accounts", async () => {
        const stranger = await seedSignedInMember(app);
        const strangerAccount = await createAccount(stranger);
        await confirmAll(stranger, await importFrom(stranger, strangerAccount, 'FR76 0001'));

        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const importId = await importFrom(fixture, accountId, 'FR76 0001');

        expect((await previewOf(fixture, importId)).statement.accountCheck).toBe('unknown');
      });

      it('keeps a fingerprint, never the identifier', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await confirmAll(fixture, await importFrom(fixture, accountId, 'FR76 0001'));

        const [stored] = await getDb(app)
          .select()
          .from(accountStatement)
          .where(eq(accountStatement.accountId, accountId));

        expect(stored.fingerprint).toMatch(/^[0-9a-f]{64}$/);
        expect(stored.fingerprint).not.toContain('0001');
      });

      describe('a file that seems to come from another account', () => {
        const later: TestTransaction[] = [{ date: '20260401', amount: '-9.00', name: 'Later' }];
        const fingerprintOf = async (accountId: string) =>
          (
            await getDb(app)
              .select()
              .from(accountStatement)
              .where(eq(accountStatement.accountId, accountId))
          )[0]?.fingerprint;

        it('is refused until the Member accepts it, and nothing is recorded', async () => {
          const fixture = await seedSignedInMember(app);
          const accountId = await createAccount(fixture);
          await confirmAll(fixture, await importFrom(fixture, accountId, 'FR76 0001'));
          const first = await fingerprintOf(accountId);
          const importId = await importFrom(fixture, accountId, 'FR76 0002', later);

          const res = await confirmImport(fixture, importId);

          expect(res.status).toBe(409);
          expect(res.body).toMatchObject({ code: 'import_account_mismatch' });
          expect(await fingerprintOf(accountId)).toBe(first);
          expect(await operationsOf(accountId)).toHaveLength(rows.length);
        });

        it('replaces what the account remembers once accepted', async () => {
          const fixture = await seedSignedInMember(app);
          const accountId = await createAccount(fixture);
          await confirmAll(fixture, await importFrom(fixture, accountId, 'FR76 0001'));
          const first = await fingerprintOf(accountId);
          const importId = await importFrom(fixture, accountId, 'FR76 0002', later);

          const res = await confirmImport(fixture, importId, { acceptAccountMismatch: true });

          expect(res.status).toBe(200);
          expect(await fingerprintOf(accountId)).not.toBe(first);
          const next = await importFrom(fixture, accountId, 'FR76 0002', later);
          expect((await previewOf(fixture, next)).statement.accountCheck).toBe('same');
        });

        it('is refused when the file was imported into another account before', async () => {
          const fixture = await seedSignedInMember(app);
          const first = await createAccount(fixture);
          const second = await createAccount(fixture);
          await confirmAll(fixture, await importFrom(fixture, first, 'FR76 0001'));
          const importId = await importFrom(fixture, second, 'FR76 0001', later);

          const refused = await confirmImport(fixture, importId);
          const accepted = await confirmImport(fixture, importId, { acceptAccountMismatch: true });

          expect(refused.status).toBe(409);
          expect(accepted.status).toBe(200);
          expect(await fingerprintOf(second)).toBe(await fingerprintOf(first));
        });
      });

      it('still recognises the account after the keys rotate, while the old key is kept', async () => {
        const crypto = app.get(CryptoService);
        crypto.loadKeys(JSON.stringify(TEST_CRYPTO_KEYS), '1');
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await confirmAll(fixture, await importFrom(fixture, accountId, 'FR76 0001'));

        crypto.loadKeys(JSON.stringify(TEST_CRYPTO_KEYS), '2');
        try {
          const importId = await importFrom(fixture, accountId, 'FR76 0001');
          expect((await previewOf(fixture, importId)).statement.accountCheck).toBe('same');
        } finally {
          crypto.loadKeys(JSON.stringify(TEST_CRYPTO_KEYS), '1');
        }
      });

      it('remembers nothing from a file that names no account', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await confirmAll(fixture, await importFrom(fixture, accountId, null));

        expect(
          await getDb(app)
            .select()
            .from(accountStatement)
            .where(eq(accountStatement.accountId, accountId)),
        ).toHaveLength(0);
      });
    });

    describe('skipped rows', () => {
      it('shows the operation each skipped row matches, and how', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await enter(fixture, accountId, {
          type: 'debit',
          thirdParty: 'bakery',
          amount: 12.5,
          paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
          valueDate: '2026-03-05',
        });
        const { importId } = await startImport(fixture, accountId, ofxFile(rows));

        const preview = await previewOf(fixture, importId);

        expect(preview.rows.map((row) => row.recorded)).toEqual([
          {
            valueDate: '2026-03-05',
            thirdParty: 'bakery',
            matchedBy: 'details',
            reconciled: false,
          },
          null,
          null,
        ]);
      });

      it('says a bank reference matched, whatever the operation became since', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const file = ofxFile([{ ...rows[0], reference: 'REF-1' }]);
        await confirmAll(fixture, (await startImport(fixture, accountId, file)).importId);
        await getDb(app)
          .update(operation)
          .set({ thirdParty: 'Renamed', valueDate: '2026-03-20' })
          .where(eq(operation.accountId, accountId));

        const again = await startImport(fixture, accountId, file);

        expect((await previewOf(fixture, again.importId)).rows[0].recorded).toEqual({
          valueDate: '2026-03-20',
          thirdParty: 'Renamed',
          matchedBy: 'reference',
          reconciled: true,
        });
      });
    });

    describe('payment method from history', () => {
      const earlier = (
        fixture: SignedInFixture,
        accountId: string,
        paymentMethodId: string,
        overrides: Record<string, unknown> = {},
      ) =>
        enter(fixture, accountId, {
          type: 'debit',
          thirdParty: 'Bakery',
          amount: 5,
          paymentMethodId,
          valueDate: '2026-01-10',
          ...overrides,
        });

      it('gives a row nothing named the method used most for its third party', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const other = await createAccount(fixture);
        await earlier(fixture, accountId, PAYMENT_METHOD_ID.CHECK_DEBIT);
        await earlier(fixture, other, PAYMENT_METHOD_ID.DIRECT_DEBIT, { thirdParty: ' BAKERY ' });
        await earlier(fixture, other, PAYMENT_METHOD_ID.DIRECT_DEBIT, { valueDate: '2026-01-11' });
        const { importId } = await startImport(fixture, accountId, ofxFile(rows));

        const preview = await previewOf(fixture, importId);

        expect(preview.rows.map((row) => [row.paymentMethodId, row.paymentMethodOrigin])).toEqual([
          [PAYMENT_METHOD_ID.DIRECT_DEBIT, 'history'],
          [PAYMENT_METHOD_ID.DEPOSIT, null],
          [PAYMENT_METHOD_ID.CREDIT_CARD, null],
        ]);
      });

      it('leaves a row the file settles alone', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await earlier(fixture, accountId, PAYMENT_METHOD_ID.CHECK_DEBIT);
        const file = ofxFile([
          { ...rows[0], type: 'ATM' },
          { ...rows[0], name: 'PRLV Bakery' },
        ]);
        const { importId } = await startImport(fixture, accountId, file);

        const preview = await previewOf(fixture, importId);

        expect(preview.rows.map((row) => [row.paymentMethodId, row.paymentMethodOrigin])).toEqual([
          [PAYMENT_METHOD_ID.CASH_WITHDRAWAL, null],
          [PAYMENT_METHOD_ID.DIRECT_DEBIT, null],
        ]);
      });

      it('stores the method shown, or the one the Member picked instead', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await earlier(fixture, accountId, PAYMENT_METHOD_ID.CHECK_DEBIT);
        const imported = async (changes: object) => {
          const { importId } = await startImport(fixture, accountId, ofxFile(rows));
          const res = await confirmImport(fixture, importId, changes);
          expect(res.status).toBe(200);
          const stored = await operationsOf(accountId);
          return stored.filter((op) => op.sourceLabel === 'Bakery').map((op) => op.paymentMethodId);
        };

        expect(await imported(NO_CHANGES)).toEqual([PAYMENT_METHOD_ID.CHECK_DEBIT]);
      });

      it('lets the Member pick another method than the suggested one', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await earlier(fixture, accountId, PAYMENT_METHOD_ID.CHECK_DEBIT);
        const { importId } = await startImport(fixture, accountId, ofxFile(rows));
        const changes = {
          paymentMethodChanges: [{ line: 1, paymentMethodId: PAYMENT_METHOD_ID.CASH_WITHDRAWAL }],
        };

        const preview = await fixture.mutate(
          'post',
          `/operations/import/${importId}/preview`,
          changes,
        );
        expect((preview.body as Preview).rows[0]).toMatchObject({
          paymentMethodId: PAYMENT_METHOD_ID.CASH_WITHDRAWAL,
          paymentMethodOrigin: 'picked',
        });
        await confirmImport(fixture, importId, changes);

        const stored = (await operationsOf(accountId)).find((op) => op.sourceLabel === 'Bakery');
        expect(stored?.paymentMethodId).toBe(PAYMENT_METHOD_ID.CASH_WITHDRAWAL);
      });

      it('never suggests the initial balance', async () => {
        const fixture = await seedSignedInMember(app);
        const bank = await fixture.mutate('post', '/banks/choice', { name: 'Other bank' });
        const opened = await fixture.mutate('post', '/accounts', {
          bankId: (bank.body as { id: string }).id,
          name: 'Opened',
          currency: 'EUR',
          initialBalance: 50,
        });
        expect(opened.status).toBeLessThan(300);
        const accountId = await createAccount(fixture);
        const file = ofxFile([{ date: '20260305', amount: '10', name: 'Initial balance' }]);
        const { importId } = await startImport(fixture, accountId, file);

        const preview = await previewOf(fixture, importId);

        expect(preview.rows[0]).toMatchObject({
          paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT,
          paymentMethodOrigin: null,
        });
      });

      it("never reads another Member's operations", async () => {
        const stranger = await seedSignedInMember(app);
        const strangerAccount = await createAccount(stranger);
        await earlier(stranger, strangerAccount, PAYMENT_METHOD_ID.CHECK_DEBIT);

        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const { importId } = await startImport(fixture, accountId, ofxFile(rows));

        expect((await previewOf(fixture, importId)).rows[0].paymentMethodId).toBe(
          PAYMENT_METHOD_ID.CREDIT_CARD,
        );
      });
    });
  });
});
