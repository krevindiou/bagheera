import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, asc, eq } from 'drizzle-orm';
import { category, labelCorrection, operation, securityEvent } from '../../db/schema';
import { PAYMENT_METHOD_ID } from '../../db/seed-data';
import { seedSignedInMember, type SignedInFixture } from '../../test-support/auth-fixture';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import { AuditService } from '../../security/audit.service';
import { ImportStore } from './import.store';
import { ImportWriter } from './import.writer';
import {
  FILE,
  NO_CHANGES,
  type Preview,
  confirmImport,
  createAccount,
  startImport,
} from '../../test-support/import-fixtures';

describe('bank file import: confirmation', () => {
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

  describe('POST /operations/import/:importId/confirm', () => {
    it('records the rows as reconciled operations, audits it and discards the file', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(
        fixture,
        accountId,
        `${FILE}\n08/03/2026;-1;${'L'.repeat(70)}`,
      );

      const res = await confirmImport(fixture, importId, NO_CHANGES);

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        importedCount: 4,
        skippedCount: 0,
        invalidCount: 0,
        rememberedCount: 0,
        notRememberedCount: 0,
        reconciledCount: 0,
        alreadyImported: false,
      });
      const imported = await operationsOf(accountId);
      expect(
        imported.map((op) => [op.valueDate, op.thirdParty.slice(0, 8), op.debit, op.credit]),
      ).toEqual([
        ['2026-03-05', 'Bakery', 125000, null],
        ['2026-03-06', 'Employer', null, 12500000],
        ['2026-03-07', 'Coffee', 30000, null],
        ['2026-03-08', 'LLLLLLLL', 10000, null],
      ]);
      expect(imported.every((op) => op.reconciled && op.categoryId === null)).toBe(true);
      expect(imported[0].paymentMethodId).toBe(PAYMENT_METHOD_ID.CREDIT_CARD);
      expect(imported[1].paymentMethodId).toBe(PAYMENT_METHOD_ID.DEPOSIT);
      expect(imported[3]).toMatchObject({ thirdParty: 'L'.repeat(64), notes: 'L'.repeat(70) });
      expect(imported.map((op) => op.sourceLabel)).toEqual([
        'Bakery',
        'Employer',
        'Coffee',
        'L'.repeat(70),
      ]);

      const events = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'operations_imported'),
            eq(securityEvent.memberId, fixture.memberId),
          ),
        );
      expect(events).toHaveLength(1);
      expect(events[0].details).toEqual({
        accountId,
        imported: 4,
        mirrored: 0,
        reconciled: 0,
        remembered: 0,
      });

      const reuse = await fixture.mutate(
        'post',
        `/operations/import/${importId}/preview`,
        NO_CHANGES,
      );
      expect(reuse.status).toBe(404);
    });

    it('reads the payment method from the type of the row, falling back to the default', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(
        fixture,
        accountId,
        'd;a;l;t\n05/03/2026;-1;A;DIRECTDEBIT\n06/03/2026;-2;B;\n07/03/2026;5;C;CHECK\n08/03/2026;-3;D;DEP',
      );
      const res = await confirmImport(fixture, importId, NO_CHANGES);
      expect(res.status).toBe(200);
      const imported = await operationsOf(accountId);
      expect(imported.map((op) => op.paymentMethodId)).toEqual([
        PAYMENT_METHOD_ID.DIRECT_DEBIT,
        PAYMENT_METHOD_ID.CREDIT_CARD,
        PAYMENT_METHOD_ID.CHECK_CREDIT,
        PAYMENT_METHOD_ID.CREDIT_CARD,
      ]);
    });

    it('imports a transfer row with no counterpart and no mirror', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(
        fixture,
        accountId,
        'd;a;l;t\n05/03/2026;-10;To savings;XFER',
      );
      await confirmImport(fixture, importId, NO_CHANGES);
      const [row] = await operationsOf(accountId);
      expect(row.paymentMethodId).toBe(PAYMENT_METHOD_ID.TRANSFER_DEBIT);
      expect(row).toMatchObject({ transferAccountId: null, transferOperationId: null });
    });

    it('imports nothing at all when no row is valid, and does not audit', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, 'd;a;l\nbad;1;x\n');
      const res = await confirmImport(fixture, importId, NO_CHANGES);
      expect(res.body).toMatchObject({ importedCount: 0, invalidCount: 1 });
      expect(await operationsOf(accountId)).toHaveLength(0);
      const events = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'operations_imported'),
            eq(securityEvent.memberId, fixture.memberId),
          ),
        );
      expect(events).toHaveLength(0);
    });

    it('answers a second confirmation of an import that created nothing with the same result', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, 'd;a;l\nbad;1;x\n');
      const first = await confirmImport(fixture, importId, NO_CHANGES);
      const second = await confirmImport(fixture, importId, NO_CHANGES);

      expect(first.body).toMatchObject({
        importedCount: 0,
        invalidCount: 1,
        alreadyImported: false,
      });
      expect(second.status).toBe(200);
      expect(second.body).toMatchObject({
        importedCount: 0,
        invalidCount: 1,
        reconciledCount: 0,
        alreadyImported: true,
      });
    });

    it('skips what an earlier import recorded, counting identical rows', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const twice = 'd;a;l\n05/03/2026;-2;Coffee\n05/03/2026;-2;Coffee\n';
      const first = await startImport(fixture, accountId, twice);
      await confirmImport(fixture, first.importId, NO_CHANGES);

      const overlapping = await startImport(
        fixture,
        accountId,
        `${twice}05/03/2026;-2;Coffee\n06/03/2026;-9;Lunch\n`,
      );
      const res = await confirmImport(fixture, overlapping.importId, NO_CHANGES);

      expect(res.body).toMatchObject({ importedCount: 2, skippedCount: 2 });
      const coffees = (await operationsOf(accountId)).filter((op) => op.thirdParty === 'Coffee');
      expect(coffees).toHaveLength(3);
    });

    it('imports a skipped row the member includes, and only skipped ones', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const content = 'd;a;l\n05/03/2026;-2;Coffee\nbad;1;x\n';
      const first = await startImport(fixture, accountId, content);
      await confirmImport(fixture, first.importId, NO_CHANGES);

      const again = await startImport(fixture, accountId, content);
      const res = await confirmImport(fixture, again.importId, {
        ...NO_CHANGES,
        includedLines: [1, 2],
      });

      expect(res.body).toMatchObject({ importedCount: 1, skippedCount: 0, invalidCount: 1 });
      const coffees = (await operationsOf(accountId)).filter((op) => op.thirdParty === 'Coffee');
      expect(coffees).toHaveLength(2);
    });

    it('creates nothing further when the same import is confirmed again', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const first = await confirmImport(fixture, importId, NO_CHANGES);
      const second = await confirmImport(fixture, importId, NO_CHANGES);

      expect(first.body).toMatchObject({ importedCount: 3, alreadyImported: false });
      expect(second.body).toMatchObject({ importedCount: 3, alreadyImported: true });
      expect(await operationsOf(accountId)).toHaveLength(3);
    });

    it('imports once when two confirmations arrive together', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const [a, b] = await Promise.all([
        confirmImport(fixture, importId, NO_CHANGES),
        confirmImport(fixture, importId, NO_CHANGES),
      ]);

      expect([a.status, b.status].sort()).toEqual([200, 409].sort());
      expect(await operationsOf(accountId)).toHaveLength(3);
    });

    it('imports nothing when the account was closed after the upload', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      await fixture.mutate('post', `/accounts/${accountId}/close`);

      const res = await confirmImport(fixture, importId, NO_CHANGES);

      expect(res.status).toBe(422);
      expect(res.body).toMatchObject({ code: 'account_not_active' });
      expect(await operationsOf(accountId)).toHaveLength(0);
    });

    it("answers not found for another member's import", async () => {
      const owner = await seedSignedInMember(app);
      const accountId = await createAccount(owner);
      const { importId } = await startImport(owner, accountId, FILE);
      const other = await seedSignedInMember(app);
      const res = await confirmImport(other, importId, NO_CHANGES);
      expect(res.status).toBe(404);
      expect(await operationsOf(accountId)).toHaveLength(0);
    });
  });

  describe('preview revision', () => {
    const post = (
      fixture: SignedInFixture,
      importId: string,
      action: 'preview' | 'confirm',
      body: object,
    ) => fixture.mutate('post', `/operations/import/${importId}/${action}`, body);
    const revisionOf = async (fixture: SignedInFixture, importId: string, body: object = {}) =>
      ((await post(fixture, importId, 'preview', body)).body as Preview).revision;
    const enter = (fixture: SignedInFixture, accountId: string, overrides: object = {}) =>
      fixture.mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Bakery',
        amount: 5,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-03-05',
        ...overrides,
      });

    it('is the same for the same operations, whatever the Member picks', async () => {
      const [food] = await getDb(app)
        .select({ id: category.id })
        .from(category)
        .where(eq(category.type, 'debit'))
        .limit(1);
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);

      const plain = await revisionOf(fixture, importId);

      expect(plain).toMatch(/^[0-9a-f]{64}$/);
      expect(await revisionOf(fixture, importId)).toBe(plain);
      expect(
        await revisionOf(fixture, importId, {
          categoryChanges: [{ line: 1, categoryId: food.id }],
        }),
      ).toBe(plain);
    });

    it('rests on the days around the dates of the rows, not on the days between them', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(
        fixture,
        accountId,
        'd;a;l\n05/03/2026;-1;A\n05/09/2026;-2;B',
      );
      const revision = await revisionOf(fixture, importId);

      // Months from both dates: the rows cannot match it.
      await enter(fixture, accountId, { thirdParty: 'Elsewhere', valueDate: '2026-06-01' });
      expect(await revisionOf(fixture, importId)).toBe(revision);

      // A day from a date of a row: a transfer row could match it.
      await enter(fixture, accountId, { thirdParty: 'Nearby', valueDate: '2026-09-07' });
      expect(await revisionOf(fixture, importId)).not.toBe(revision);
    });

    it('refuses a confirmation when an operation is entered after the rows were worked out', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const revision = await revisionOf(fixture, importId);
      // Entered between the check of the revision and the lock of the account.
      const writer = app.get(ImportWriter);
      const insertAll = writer.insertAll.bind(writer);
      const spy = vi.spyOn(writer, 'insertAll').mockImplementationOnce(async (input) => {
        await enter(fixture, accountId, { thirdParty: 'Bakery', amount: 12.5 });
        return insertAll(input);
      });

      const res = await post(fixture, importId, 'confirm', { revision });
      spy.mockRestore();

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'import_preview_stale' });
      expect(await operationsOf(accountId)).toHaveLength(1);
    });

    it('refuses a confirmation that names no revision', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);

      const res = await post(fixture, importId, 'confirm', {});

      expect(res.status).toBe(400);
      expect(await operationsOf(accountId)).toHaveLength(0);
    });

    it('refuses a confirmation when an operation around the file changed since the preview', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const revision = await revisionOf(fixture, importId);
      await enter(fixture, accountId, { thirdParty: 'Other', amount: 1 });

      const res = await post(fixture, importId, 'confirm', { revision });

      expect(res.status).toBe(409);
      expect(res.body).toMatchObject({ code: 'import_preview_stale' });
      expect(await operationsOf(accountId)).toHaveLength(1);

      const fresh = await post(fixture, importId, 'confirm', {
        revision: await revisionOf(fixture, importId),
      });
      expect(fresh.status).toBe(200);
      expect(await operationsOf(accountId)).toHaveLength(4);
    });

    it('refuses a confirmation when the history behind a suggestion changed since the preview', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const revision = await revisionOf(fixture, importId);
      await enter(fixture, accountId, { valueDate: '2020-01-01' });

      const res = await post(fixture, importId, 'confirm', { revision });

      expect(res.status).toBe(409);
      expect(await operationsOf(accountId)).toHaveLength(1);
    });

    it('accepts a confirmation when more operations only back the same suggestions', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await enter(fixture, accountId, { valueDate: '2020-01-01' });
      const { importId } = await startImport(fixture, accountId, FILE);
      const revision = await revisionOf(fixture, importId);
      await enter(fixture, accountId, { valueDate: '2020-01-02' });

      const res = await post(fixture, importId, 'confirm', { revision });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ alreadyImported: false });
    });

    it('refuses a confirmation when a label correction changed since the preview', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const revision = await revisionOf(fixture, importId);
      await getDb(app).insert(labelCorrection).values({
        memberId: fixture.memberId,
        sourceLabel: 'Bakery',
        thirdParty: 'Boulangerie',
      });

      const res = await post(fixture, importId, 'confirm', { revision });

      expect(res.status).toBe(409);
      expect(await operationsOf(accountId)).toHaveLength(0);
    });
  });

  describe('around the moment of recording', () => {
    it('answers with the first result when that confirmation finished as this one began', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const first = await confirmImport(fixture, importId);
      expect(first.body).toMatchObject({ importedCount: 3, alreadyImported: false });
      // The second confirmation looked before the first one saved its result.
      const store = app.get(ImportStore);
      const spy = vi.spyOn(store, 'loadOutcome').mockResolvedValueOnce(null);

      const second = await confirmImport(fixture, importId);
      spy.mockRestore();

      expect(second.status).toBe(200);
      expect(second.body).toMatchObject({ importedCount: 3, alreadyImported: true });
      expect(await operationsOf(accountId)).toHaveLength(3);
    });

    it('still answers with the result when it cannot be remembered afterwards', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const store = app.get(ImportStore);
      const spies = [
        vi.spyOn(store, 'saveOutcome').mockRejectedValueOnce(new Error('store down')),
        vi.spyOn(store, 'discard').mockRejectedValueOnce(new Error('store down')),
        vi.spyOn(store, 'unlockConfirmation').mockRejectedValueOnce(new Error('store down')),
      ];

      const res = await confirmImport(fixture, importId);
      spies.forEach((spy) => spy.mockRestore());

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ importedCount: 3, alreadyImported: false });
      expect(await operationsOf(accountId)).toHaveLength(3);
    });

    it('still answers with the result when the audit cannot be written afterwards', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const spy = vi
        .spyOn(app.get(AuditService), 'record')
        .mockRejectedValueOnce(new Error('down'));

      const res = await confirmImport(fixture, importId);
      spy.mockRestore();

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ importedCount: 3, alreadyImported: false });
      expect(await operationsOf(accountId)).toHaveLength(3);
    });
  });
});
