import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, asc, eq } from 'drizzle-orm';
import request from 'supertest';
import { IMPORT_LIMITS } from '@bagheera/reference-data';
import { labelCorrection, operation, securityEvent } from '../../db/schema';
import { PAYMENT_METHOD_ID } from '../../db/seed-data';
import { seedSignedInMember, type SignedInFixture } from '../../test-support/auth-fixture';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import {
  NO_CHANGES,
  type LabelChange,
  type Preview,
  confirmImport,
  createAccount,
  startImport,
} from '../../test-support/import-fixtures';

describe('bank file import: label corrections', () => {
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

  describe('label corrections', () => {
    const BANK_FILE = [
      'Date;Amount;Label',
      '05/03/2026;-12,50;CARREFOUR MARKET',
      '06/03/2026;-60,00;EDF ENERGIE',
    ].join('\n');

    const correctionsOf = (memberId: string) =>
      getDb(app).select().from(labelCorrection).where(eq(labelCorrection.memberId, memberId));

    const confirm = async (
      fixture: SignedInFixture,
      importId: string,
      labelChanges: LabelChange[] = [],
      extra: object = {},
    ) =>
      confirmImport(fixture, importId, {
        ...NO_CHANGES,
        labelChanges,
        ...extra,
      });

    const previewOf = async (
      fixture: SignedInFixture,
      importId: string,
      labelChanges: LabelChange[] = [],
    ) => {
      const res = await fixture.mutate('post', `/operations/import/${importId}/preview`, {
        ...NO_CHANGES,
        labelChanges,
      });
      expect(res.status).toBe(200);
      return res.body as Preview;
    };

    async function importWithChange(
      fixture: SignedInFixture,
      accountId: string,
      content: string,
      changes: LabelChange[],
    ) {
      const { importId } = await startImport(fixture, accountId, content);
      const res = await confirm(fixture, importId, changes);
      expect(res.status).toBe(200);
      return res.body as { importedCount: number; rememberedCount: number };
    }

    it('shows a changed label next to the label of the file, and re-checks the row', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, BANK_FILE);

      const preview = await previewOf(fixture, importId, [
        { line: 1, thirdParty: ' Carrefour ', remember: false },
        { line: 2, thirdParty: '   ', remember: false },
      ]);

      expect(preview.rows[0]).toMatchObject({
        status: 'import',
        thirdParty: 'Carrefour',
        sourceLabel: 'CARREFOUR MARKET',
        labelOrigin: 'change',
      });
      expect(preview.rows[1]).toMatchObject({
        status: 'invalid',
        reason: 'third_party_missing',
        sourceLabel: 'EDF ENERGIE',
      });
      expect(preview).toMatchObject({ importCount: 1, invalidCount: 1 });
    });

    it('lets a change fix a row the file made invalid', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(
        fixture,
        accountId,
        ['Date;Amount;Label', `05/03/2026;-1,00;`, `06/03/2026;-1,00;${'x'.repeat(4097)}`].join(
          '\n',
        ),
      );

      const before = await previewOf(fixture, importId);
      expect(before.rows.map((row) => row.reason)).toEqual([
        'third_party_missing',
        'third_party_too_long',
      ]);
      // The label shown for the Member to read is cut.
      expect(before.rows[1].sourceLabel).toHaveLength(IMPORT_LIMITS.PREVIEW_LABEL_CHARACTERS);

      const after = await previewOf(fixture, importId, [
        { line: 1, thirdParty: 'Bakery', remember: false },
        { line: 2, thirdParty: 'Butcher', remember: true },
      ]);
      expect(after).toMatchObject({ importCount: 2, invalidCount: 0 });
    });

    it('stores the changed label and the label of the file, and remembers only what was chosen', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);

      const result = await importWithChange(fixture, accountId, BANK_FILE, [
        { line: 1, thirdParty: 'Carrefour', remember: true },
        { line: 2, thirdParty: 'EDF', remember: false },
      ]);

      expect(result).toMatchObject({ importedCount: 2, rememberedCount: 1 });
      expect(
        (await operationsOf(accountId)).map((op) => [op.thirdParty, op.sourceLabel, op.notes]),
      ).toEqual([
        ['Carrefour', 'CARREFOUR MARKET', ''],
        ['EDF', 'EDF ENERGIE', ''],
      ]);
      expect(
        (await correctionsOf(fixture.memberId)).map((row) => [row.sourceLabel, row.thirdParty]),
      ).toEqual([['CARREFOUR MARKET', 'Carrefour']]);
    });

    it('applies a remembered correction to the next import, whatever the case of the label', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await importWithChange(fixture, accountId, BANK_FILE, [
        { line: 1, thirdParty: 'Carrefour', remember: true },
      ]);

      const { importId } = await startImport(
        fixture,
        accountId,
        ['Date;Amount;Label', '09/03/2026;-8,00;  carrefour market '].join('\n'),
      );
      const preview = await previewOf(fixture, importId);

      expect(preview.rows[0]).toMatchObject({
        status: 'import',
        thirdParty: 'Carrefour',
        sourceLabel: 'carrefour market',
        labelOrigin: 'correction',
      });
      const res = await confirm(fixture, importId);
      expect(res.status).toBe(200);
      const stored = (await operationsOf(accountId)).find((op) => op.valueDate === '2026-03-09');
      expect(stored).toMatchObject({ thirdParty: 'Carrefour', notes: '' });
    });

    it('stores the third party without payment wording, date and amount, with the full label in the notes', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(
        fixture,
        accountId,
        ['Date;Amount;Label', '05/03/2026;-12,50;PRLV SEPA EDF ENERGIE 05/03 12,50EUR'].join('\n'),
      );
      const res = await confirm(fixture, importId);
      expect(res.status).toBe(200);

      expect(await operationsOf(accountId)).toEqual([
        expect.objectContaining({
          thirdParty: 'EDF ENERGIE',
          notes: 'PRLV SEPA EDF ENERGIE 05/03 12,50EUR',
          sourceLabel: 'PRLV SEPA EDF ENERGIE 05/03 12,50EUR',
          paymentMethodId: PAYMENT_METHOD_ID.DIRECT_DEBIT,
        }),
      ]);
    });

    it('remembers a label without its date and amount and applies it to other dates and amounts', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await importWithChange(
        fixture,
        accountId,
        ['Date;Amount;Label', '05/03/2026;-12,50;LA BOULANGERIE 05/03 12,50EUR'].join('\n'),
        [{ line: 1, thirdParty: 'Bakery', remember: true }],
      );
      expect(
        (await correctionsOf(fixture.memberId)).map((row) => [row.sourceLabel, row.thirdParty]),
      ).toEqual([['LA BOULANGERIE', 'Bakery']]);

      const { importId } = await startImport(
        fixture,
        accountId,
        ['Date;Amount;Label', '17/04/2026;-3,10;la boulangerie 17/04 3,10EUR'].join('\n'),
      );
      const preview = await previewOf(fixture, importId);
      expect(preview.rows[0]).toMatchObject({
        status: 'import',
        thirdParty: 'Bakery',
        sourceLabel: 'la boulangerie 17/04 3,10EUR',
        labelOrigin: 'correction',
      });
    });

    it('still applies a correction remembered with a date and amount in its label', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await getDb(app).insert(labelCorrection).values({
        memberId: fixture.memberId,
        sourceLabel: 'LA BOULANGERIE 05/03 12,50EUR',
        thirdParty: 'Bakery',
      });

      const { importId } = await startImport(
        fixture,
        accountId,
        ['Date;Amount;Label', '17/04/2026;-3,10;LA BOULANGERIE 17/04 3,10EUR'].join('\n'),
      );
      const preview = await previewOf(fixture, importId);
      expect(preview.rows[0]).toMatchObject({ thirdParty: 'Bakery', labelOrigin: 'correction' });
    });

    it('keeps one correction per label of the file: remembering again replaces it', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const first = await importWithChange(fixture, accountId, BANK_FILE, [
        { line: 1, thirdParty: 'Carrefour', remember: true },
      ]);
      expect(first.rememberedCount).toBe(1);

      const again = await startImport(
        fixture,
        accountId,
        ['Date;Amount;Label', '09/03/2026;-8,00;carrefour market'].join('\n'),
      );
      const replaced = await confirm(fixture, again.importId, [
        { line: 1, thirdParty: 'Supermarket', remember: true },
      ]);

      expect(replaced.body).toMatchObject({ rememberedCount: 1 });
      expect(
        (await correctionsOf(fixture.memberId)).map((row) => [row.sourceLabel, row.thirdParty]),
      ).toEqual([['CARREFOUR MARKET', 'Supermarket']]);
    });

    it('removes a correction when the row is changed back to the label of the file and remembered', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await importWithChange(fixture, accountId, BANK_FILE, [
        { line: 2, thirdParty: 'EDF', remember: true },
      ]);

      const { importId } = await startImport(
        fixture,
        accountId,
        ['Date;Amount;Label', '09/03/2026;-8,00;EDF ENERGIE'].join('\n'),
      );
      const kept = await previewOf(fixture, importId, [
        { line: 1, thirdParty: 'EDF ENERGIE', remember: false },
      ]);
      expect(kept.rows[0]).toMatchObject({ thirdParty: 'EDF ENERGIE', labelOrigin: 'file' });
      expect(await correctionsOf(fixture.memberId)).toHaveLength(1);

      const res = await confirm(fixture, importId, [
        { line: 1, thirdParty: 'EDF ENERGIE', remember: true },
      ]);

      expect(res.body).toMatchObject({ importedCount: 1, rememberedCount: 0 });
      expect(await correctionsOf(fixture.memberId)).toHaveLength(0);
    });

    it('does not remember a change that is not a third party, nor one on an empty label', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);

      const result = await importWithChange(
        fixture,
        accountId,
        ['Date;Amount;Label', '05/03/2026;-1,00;Shop', '06/03/2026;-2,00;'].join('\n'),
        [
          { line: 1, thirdParty: 'y'.repeat(65), remember: true },
          { line: 2, thirdParty: 'Bakery', remember: true },
        ],
      );

      expect(result).toMatchObject({ importedCount: 1, rememberedCount: 0 });
      expect(await correctionsOf(fixture.memberId)).toHaveLength(0);
    });

    it('recognises a row again after a one-off change', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await importWithChange(fixture, accountId, BANK_FILE, [
        { line: 1, thirdParty: 'Carrefour', remember: false },
      ]);

      const { importId } = await startImport(fixture, accountId, BANK_FILE);
      const preview = await previewOf(fixture, importId);

      expect(preview.rows.map((row) => row.status)).toEqual(['skipped', 'skipped']);
    });

    it('recognises a row again after its correction was deleted', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await importWithChange(fixture, accountId, BANK_FILE, [
        { line: 1, thirdParty: 'Carrefour', remember: true },
      ]);
      const [correction] = await correctionsOf(fixture.memberId);
      await fixture.mutate('post', '/label-corrections/delete', { ids: [correction.id] });

      const { importId } = await startImport(fixture, accountId, BANK_FILE);
      const preview = await previewOf(fixture, importId);

      expect(preview.rows.map((row) => row.status)).toEqual(['skipped', 'skipped']);
    });

    it('does not use the label of the file for an operation typed by hand', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const typed = await fixture.mutate('post', '/operations', {
        accountId,
        type: 'debit',
        amount: 12.5,
        valueDate: '2026-03-05',
        thirdParty: 'Somebody else',
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      });
      expect(typed.status).toBeLessThan(300);

      const { importId } = await startImport(fixture, accountId, BANK_FILE);
      const preview = await previewOf(fixture, importId);

      expect(preview.rows.map((row) => row.status)).toEqual(['import', 'import']);
    });

    it("applies a Member's own corrections only", async () => {
      const owner = await seedSignedInMember(app);
      const other = await seedSignedInMember(app);
      const ownerAccount = await createAccount(owner);
      const otherAccount = await createAccount(other);
      await importWithChange(owner, ownerAccount, BANK_FILE, [
        { line: 1, thirdParty: 'Carrefour', remember: true },
      ]);

      const { importId } = await startImport(other, otherAccount, BANK_FILE);
      const preview = await previewOf(other, importId);

      expect(preview.rows[0]).toMatchObject({
        thirdParty: 'CARREFOUR MARKET',
        labelOrigin: 'file',
      });
    });

    it('remembers nothing when nothing is imported', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await importWithChange(fixture, accountId, BANK_FILE, []);

      const { importId } = await startImport(fixture, accountId, BANK_FILE);
      const res = await confirm(fixture, importId, [
        { line: 1, thirdParty: 'Carrefour', remember: true },
      ]);

      expect(res.body).toMatchObject({ importedCount: 0, rememberedCount: 0 });
      expect(await correctionsOf(fixture.memberId)).toHaveLength(0);
    });

    it('refuses a duplicated line and a malformed change', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, BANK_FILE);

      const duplicated = await confirm(fixture, importId, [
        { line: 1, thirdParty: 'A', remember: false },
        { line: 1, thirdParty: 'B', remember: false },
      ]);
      const malformed = await fixture.mutate('post', `/operations/import/${importId}/preview`, {
        ...NO_CHANGES,
        labelChanges: [{ line: 0, thirdParty: 'A' }],
      });

      expect(duplicated.status).toBe(400);
      expect(malformed.status).toBe(400);
      expect(await operationsOf(accountId)).toHaveLength(0);
    });

    it('takes the many choices of a large file, beyond the default body size', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, BANK_FILE);
      const labelChanges = Array.from({ length: 4000 }, (_, i) => ({
        line: i + 1,
        thirdParty: 'Somewhere',
        remember: false,
      }));
      expect(JSON.stringify({ labelChanges }).length).toBeGreaterThan(100 * 1024);

      const res = await fixture.mutate('post', `/operations/import/${importId}/preview`, {
        labelChanges,
      });

      expect(res.status).toBe(200);
    });

    describe('quota (NFR-022)', () => {
      const fill = async (memberId: string, count: number) => {
        await getDb(app)
          .insert(labelCorrection)
          .values(
            Array.from({ length: count }, (_, i) => ({
              memberId,
              sourceLabel: `LABEL ${i}`,
              thirdParty: `Third party ${i}`,
            })),
          );
      };

      it('imports anyway and leaves out the corrections beyond 1,000', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await fill(fixture.memberId, IMPORT_LIMITS.MAX_LABEL_CORRECTIONS - 1);
        const { importId } = await startImport(fixture, accountId, BANK_FILE);

        const res = await confirm(fixture, importId, [
          { line: 1, thirdParty: 'Carrefour', remember: true },
          { line: 2, thirdParty: 'EDF', remember: true },
        ]);

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
          importedCount: 2,
          rememberedCount: 1,
          notRememberedCount: 1,
        });
        expect(await operationsOf(accountId)).toHaveLength(2);
        const kept = await correctionsOf(fixture.memberId);
        expect(kept).toHaveLength(IMPORT_LIMITS.MAX_LABEL_CORRECTIONS);
        expect(kept.map((c) => c.thirdParty)).toContain('Carrefour');
        expect(kept.map((c) => c.thirdParty)).not.toContain('EDF');
      });

      it('makes room for a new correction with a forgotten one', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await fill(fixture.memberId, IMPORT_LIMITS.MAX_LABEL_CORRECTIONS);
        const { importId } = await startImport(
          fixture,
          accountId,
          ['Date;Amount;Label', '05/03/2026;-1,00;label 7', '06/03/2026;-1,00;Bakery'].join('\n'),
        );

        // Line 1 goes back to its label, which forgets that correction.
        const res = await confirm(fixture, importId, [
          { line: 1, thirdParty: 'label 7', remember: true },
          { line: 2, thirdParty: 'Boulangerie', remember: true },
        ]);

        expect(res.body).toMatchObject({ rememberedCount: 1, notRememberedCount: 0 });
      });

      it('still lets a correction replace another at the limit', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await fill(fixture.memberId, IMPORT_LIMITS.MAX_LABEL_CORRECTIONS);
        const { importId } = await startImport(
          fixture,
          accountId,
          ['Date;Amount;Label', '05/03/2026;-1,00;label 7'].join('\n'),
        );

        const res = await confirm(fixture, importId, [
          { line: 1, thirdParty: 'Renamed', remember: true },
        ]);

        expect(res.body).toMatchObject({ importedCount: 1, rememberedCount: 1 });
      });
    });
  });

  describe('GET /label-corrections and POST /label-corrections/delete', () => {
    const seedCorrections = async (memberId: string, labels: string[]) => {
      const rows = await getDb(app)
        .insert(labelCorrection)
        .values(labels.map((sourceLabel) => ({ memberId, sourceLabel, thirdParty: 'Third party' })))
        .returning({ id: labelCorrection.id });
      return rows.map((row) => row.id);
    };

    const auditCount = async (memberId: string) =>
      (
        await getDb(app)
          .select()
          .from(securityEvent)
          .where(
            and(
              eq(securityEvent.eventType, 'label_corrections_deleted'),
              eq(securityEvent.memberId, memberId),
            ),
          )
      ).length;

    it('lists the own corrections alphabetically, with the limit', async () => {
      const fixture = await seedSignedInMember(app);
      const other = await seedSignedInMember(app);
      await seedCorrections(fixture.memberId, ['b label', 'A label', 'C label']);
      await seedCorrections(other.memberId, ['Foreign']);

      const res = await fixture.agent.get('/label-corrections');

      expect(res.status).toBe(200);
      const body = res.body as { items: { sourceLabel: string }[]; limit: number };
      expect(body.items.map((item) => item.sourceLabel)).toEqual(['A label', 'b label', 'C label']);
      expect(body.limit).toBe(IMPORT_LIMITS.MAX_LABEL_CORRECTIONS);
    });

    it('lists nothing for a Member who remembered nothing', async () => {
      const fixture = await seedSignedInMember(app);
      const res = await fixture.agent.get('/label-corrections');
      expect(res.body).toMatchObject({ items: [] });
    });

    it('requires a signed-in Member', async () => {
      const res = await request(app.getHttpServer()).get('/label-corrections');
      expect(res.status).toBe(401);
    });

    it('deletes the chosen corrections, audits it, and leaves the others', async () => {
      const fixture = await seedSignedInMember(app);
      const [first, second, third] = await seedCorrections(fixture.memberId, ['a', 'b', 'c']);

      const res = await fixture.mutate('post', '/label-corrections/delete', {
        ids: [first, third],
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ deletedCount: 2 });
      const left = await getDb(app)
        .select()
        .from(labelCorrection)
        .where(eq(labelCorrection.memberId, fixture.memberId));
      expect(left.map((row) => row.id)).toEqual([second]);
      expect(await auditCount(fixture.memberId)).toBe(1);
    });

    it("treats another Member's correction and an unknown one as already gone", async () => {
      const fixture = await seedSignedInMember(app);
      const other = await seedSignedInMember(app);
      const [foreign] = await seedCorrections(other.memberId, ['foreign']);

      const res = await fixture.mutate('post', '/label-corrections/delete', {
        ids: [foreign, '01960000-0000-7000-8000-000000000000'],
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ deletedCount: 0 });
      expect(
        await getDb(app).select().from(labelCorrection).where(eq(labelCorrection.id, foreign)),
      ).toHaveLength(1);
      expect(await auditCount(fixture.memberId)).toBe(0);
    });

    it('refuses an empty or malformed list of ids', async () => {
      const fixture = await seedSignedInMember(app);
      expect((await fixture.mutate('post', '/label-corrections/delete', { ids: [] })).status).toBe(
        400,
      );
      expect(
        (await fixture.mutate('post', '/label-corrections/delete', { ids: ['nope'] })).status,
      ).toBe(400);
    });

    it('never alters an operation already imported', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(
        fixture,
        accountId,
        ['Date;Amount;Label', '05/03/2026;-1,00;PRLV EDF'].join('\n'),
      );
      await confirmImport(fixture, importId, {
        ...NO_CHANGES,
        labelChanges: [{ line: 1, thirdParty: 'EDF', remember: true }],
      });
      const rows = await getDb(app)
        .select()
        .from(labelCorrection)
        .where(eq(labelCorrection.memberId, fixture.memberId));

      await fixture.mutate('post', '/label-corrections/delete', { ids: rows.map((row) => row.id) });

      expect((await operationsOf(accountId)).map((op) => op.thirdParty)).toEqual(['EDF']);
    });
  });
});
