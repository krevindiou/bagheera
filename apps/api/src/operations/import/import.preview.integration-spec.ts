import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { asc, eq } from 'drizzle-orm';
import { category, operation } from '../../db/schema';
import { PAYMENT_METHOD_ID, SALARY_CATEGORY_SEED_ID } from '../../db/seed-data';
import { seedSignedInMember, type SignedInFixture } from '../../test-support/auth-fixture';
import { createTestApp, getDb } from '../../test-support/create-test-app';
import {
  FILE,
  NO_CHANGES,
  type Preview,
  confirmImport,
  createAccount,
  startImport,
} from '../../test-support/import-fixtures';

describe('bank file import: preview', () => {
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
    it('sorts the rows into import, skipped and invalid with reasons', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      await fixture.mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'bakery',
        amount: 12.5,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-03-05',
      });
      const { importId } = await startImport(
        fixture,
        accountId,
        `${FILE}\nnot a date;-1;Oops\n08/03/2026;abc;Oops`,
      );

      const res = await fixture.mutate(
        'post',
        `/operations/import/${importId}/preview`,
        NO_CHANGES,
      );

      expect(res.status).toBe(200);
      const preview = res.body as Preview;
      expect(preview).toMatchObject({ importCount: 2, skippedCount: 1, invalidCount: 2 });
      expect(preview.rows.map((r) => [r.line, r.status, r.reason])).toEqual([
        [1, 'skipped', null],
        [2, 'import', null],
        [3, 'import', null],
        [4, 'invalid', 'date_invalid'],
        [5, 'invalid', 'amount_invalid'],
      ]);
      expect(preview.rows[1].amount).toBe(1250);
      expect(await operationsOf(accountId)).toHaveLength(1);
    });

    it('can be run again, and answers the same each time', async () => {
      const fixture = await seedSignedInMember(app);
      const accountId = await createAccount(fixture);
      const { importId } = await startImport(fixture, accountId, FILE);
      const preview = () =>
        fixture.mutate('post', `/operations/import/${importId}/preview`, NO_CHANGES);

      const first = await preview();
      const second = await preview();

      expect(first.status).toBe(200);
      expect((first.body as Preview).importCount).toBe(3);
      expect(second.body).toEqual(first.body);
    });

    describe('payment methods picked for single rows', () => {
      const picked = (...changes: { line: number; paymentMethodId: string }[]) => ({
        ...NO_CHANGES,
        paymentMethodChanges: changes,
      });
      const previewWith = async (body: object) => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const { importId } = await startImport(fixture, accountId, FILE);
        return {
          fixture,
          accountId,
          importId,
          res: await fixture.mutate('post', `/operations/import/${importId}/preview`, body),
        };
      };

      it('shows the picked payment method on its row only', async () => {
        const { res } = await previewWith(
          picked({ line: 3, paymentMethodId: PAYMENT_METHOD_ID.CASH_WITHDRAWAL }),
        );
        expect(res.status).toBe(200);
        expect((res.body as Preview).rows.map((row) => row.paymentMethodId)).toEqual([
          PAYMENT_METHOD_ID.CREDIT_CARD,
          PAYMENT_METHOD_ID.DEPOSIT,
          PAYMENT_METHOD_ID.CASH_WITHDRAWAL,
        ]);
      });

      it('stores the picked payment method when confirming', async () => {
        const { fixture, accountId, importId } = await previewWith(NO_CHANGES);
        const res = await confirmImport(fixture, importId, {
          ...NO_CHANGES,
          paymentMethodChanges: [{ line: 1, paymentMethodId: PAYMENT_METHOD_ID.DIRECT_DEBIT }],
        });
        expect(res.status).toBe(200);
        const stored = await operationsOf(accountId);
        expect(stored.find((op) => op.thirdParty === 'Bakery')?.paymentMethodId).toBe(
          PAYMENT_METHOD_ID.DIRECT_DEBIT,
        );
        expect(stored.find((op) => op.thirdParty === 'Coffee')?.paymentMethodId).toBe(
          PAYMENT_METHOD_ID.CREDIT_CARD,
        );
      });

      it.each([
        ['a method of the other type', PAYMENT_METHOD_ID.DEPOSIT],
        ['the initial balance', PAYMENT_METHOD_ID.INITIAL_BALANCE],
        ['an unknown method', '01990000-0000-7000-8000-00000000ffff'],
      ])('refuses %s', async (_name, paymentMethodId) => {
        const { res } = await previewWith(picked({ line: 1, paymentMethodId }));
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'payment_method_invalid' });
      });

      it('ignores a line that is no readable row, and refuses a malformed or repeated one', async () => {
        const ignored = await previewWith(
          picked({ line: 99, paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT }),
        );
        expect(ignored.res.status).toBe(200);

        for (const changes of [
          [{ line: 0, paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD }],
          [{ line: 1, paymentMethodId: 'x' }],
          [
            { line: 1, paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD },
            { line: 1, paymentMethodId: PAYMENT_METHOD_ID.DIRECT_DEBIT },
          ],
        ]) {
          const { res } = await previewWith(picked(...changes));
          expect(res.status).toBe(400);
        }
      });
    });

    describe('categories from history and picked for single rows', () => {
      const debitCategories = async () =>
        (
          await getDb(app)
            .select({ id: category.id })
            .from(category)
            .where(eq(category.type, 'debit'))
            .limit(2)
        ).map((row) => row.id);

      const record = (
        fixture: SignedInFixture,
        accountId: string,
        thirdParty: string,
        categoryId: string,
        valueDate = '2026-01-10',
        type: 'debit' | 'credit' = 'debit',
      ) =>
        fixture.mutate('post', '/operations', {
          accountId,
          type,
          thirdParty,
          amount: 5,
          paymentMethodId:
            type === 'debit' ? PAYMENT_METHOD_ID.CREDIT_CARD : PAYMENT_METHOD_ID.DEPOSIT,
          categoryId,
          valueDate,
        });

      const previewOf = async (
        fixture: SignedInFixture,
        accountId: string,
        body: object = NO_CHANGES,
      ) => {
        const { importId } = await startImport(fixture, accountId, FILE);
        const res = await fixture.mutate('post', `/operations/import/${importId}/preview`, body);
        expect(res.status).toBe(200);
        return { importId, preview: res.body as Preview };
      };

      it('suggests the category used before for the same third party and type', async () => {
        const [food] = await debitCategories();
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await record(fixture, accountId, ' BAKERY ', food);
        await record(
          fixture,
          accountId,
          'Employer',
          SALARY_CATEGORY_SEED_ID,
          '2026-01-11',
          'credit',
        );

        const { preview } = await previewOf(fixture, accountId);

        expect(preview.rows.map((row) => [row.categoryId, row.categoryOrigin])).toEqual([
          [food, 'history'],
          [SALARY_CATEGORY_SEED_ID, 'history'],
          [null, null],
        ]);
      });

      it('finds a third party typed with a no-break space or a tab around it', async () => {
        const [food] = await debitCategories();
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await record(fixture, accountId, '\u00a0BAKERY\t', food);

        const { preview } = await previewOf(fixture, accountId);

        expect(preview.rows[0]).toMatchObject({ categoryId: food, categoryOrigin: 'history' });
      });

      it('does not mix debits and credits of one third party', async () => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await record(fixture, accountId, 'Bakery', SALARY_CATEGORY_SEED_ID, '2026-01-10', 'credit');
        const { preview } = await previewOf(fixture, accountId);
        expect(preview.rows[0].categoryId).toBeNull();
      });

      it('learns from every account of the Member, and from nobody else', async () => {
        const [food] = await debitCategories();
        const fixture = await seedSignedInMember(app);
        const otherAccount = await createAccount(fixture);
        const accountId = await createAccount(fixture);
        await record(fixture, otherAccount, 'Bakery', food);
        const stranger = await seedSignedInMember(app);
        const strangerAccount = await createAccount(stranger);
        await record(stranger, strangerAccount, 'Coffee', food);

        const { preview } = await previewOf(fixture, accountId);

        expect(preview.rows.map((row) => row.categoryId)).toEqual([food, null, null]);
      });

      it('takes the category used most, then the most recent on a tie', async () => {
        const [food, gift] = await debitCategories();
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await record(fixture, accountId, 'Bakery', food, '2026-01-01');
        await record(fixture, accountId, 'Bakery', food, '2026-01-02');
        await record(fixture, accountId, 'Bakery', gift, '2026-02-01');
        await record(fixture, accountId, 'Coffee', food, '2026-01-01');
        await record(fixture, accountId, 'Coffee', gift, '2026-02-01');

        const { preview } = await previewOf(fixture, accountId);

        expect(preview.rows.map((row) => row.categoryId)).toEqual([food, null, gift]);
      });

      it('follows a changed third party', async () => {
        const [food] = await debitCategories();
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await record(fixture, accountId, 'Boulangerie', food);

        const { preview } = await previewOf(fixture, accountId, {
          labelChanges: [{ line: 1, thirdParty: 'boulangerie', remember: false }],
        });

        expect(preview.rows[0]).toMatchObject({ categoryId: food, categoryOrigin: 'history' });
      });

      it('shows a picked category, or none, in place of the suggestion', async () => {
        const [food, gift] = await debitCategories();
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await record(fixture, accountId, 'Bakery', food);
        await record(fixture, accountId, 'Coffee', food);

        const { preview } = await previewOf(fixture, accountId, {
          categoryChanges: [
            { line: 1, categoryId: gift },
            { line: 3, categoryId: null },
          ],
        });

        expect(preview.rows.map((row) => [row.categoryId, row.categoryOrigin])).toEqual([
          [gift, 'picked'],
          [null, null],
          [null, null],
        ]);
      });

      it('stores the suggested, the picked and the removed categories when confirming', async () => {
        const [food, gift] = await debitCategories();
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        await record(fixture, accountId, 'Bakery', food);
        await record(fixture, accountId, 'Coffee', food);
        await record(
          fixture,
          accountId,
          'Employer',
          SALARY_CATEGORY_SEED_ID,
          '2026-01-11',
          'credit',
        );
        const { importId } = await startImport(fixture, accountId, FILE);

        const res = await confirmImport(fixture, importId, {
          categoryChanges: [
            { line: 1, categoryId: gift },
            { line: 3, categoryId: null },
          ],
        });

        expect(res.status).toBe(200);
        const stored = (await operationsOf(accountId)).filter((op) => op.valueDate >= '2026-03-01');
        const categoryOf = (thirdParty: string) =>
          stored.find((op) => op.thirdParty === thirdParty)?.categoryId;
        expect(categoryOf('Bakery')).toBe(gift);
        expect(categoryOf('Employer')).toBe(SALARY_CATEGORY_SEED_ID);
        expect(categoryOf('Coffee')).toBeNull();
      });

      it.each([
        ['a category of the other type', () => Promise.resolve(SALARY_CATEGORY_SEED_ID)],
        ['an unknown category', () => Promise.resolve('01990000-0000-7000-8000-00000000ffff')],
      ])('refuses %s', async (_name, pick) => {
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const { importId } = await startImport(fixture, accountId, FILE);
        const res = await fixture.mutate('post', `/operations/import/${importId}/preview`, {
          categoryChanges: [{ line: 1, categoryId: await pick() }],
        });
        expect(res.status).toBe(400);
        expect(res.body).toMatchObject({ code: 'category_invalid' });
      });

      it('ignores a line that is no readable row, and refuses a malformed or repeated one', async () => {
        const [food, gift] = await debitCategories();
        const fixture = await seedSignedInMember(app);
        const accountId = await createAccount(fixture);
        const { importId } = await startImport(fixture, accountId, FILE);
        const send = (categoryChanges: object[]) =>
          fixture.mutate('post', `/operations/import/${importId}/preview`, { categoryChanges });

        expect((await send([{ line: 99, categoryId: food }])).status).toBe(200);
        for (const changes of [
          [{ line: 0, categoryId: food }],
          [{ line: 1, categoryId: 'x' }],
          [{ line: 1 }],
          [
            { line: 1, categoryId: food },
            { line: 1, categoryId: gift },
          ],
        ]) {
          expect((await send(changes)).status).toBe(400);
        }
      });
    });
  });
});
