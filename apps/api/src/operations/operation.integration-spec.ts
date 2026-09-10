import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { toMinorUnits } from '../common/money';
import { category, operation } from '../db/schema';
import { PAYMENT_METHOD_ID, SALARY_CATEGORY_SEED_ID } from '../db/seed-data';
import {
  seedSignedInMember,
  SignedInFixture,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

async function debitCategoryId(app: INestApplication<Server>): Promise<string> {
  const [row] = await getDb(app)
    .select({ id: category.id })
    .from(category)
    .where(eq(category.type, 'debit'));
  return row.id;
}

async function createBank(mutate: SignedInFixture['mutate']): Promise<string> {
  const res = await mutate('post', '/banks/choice', { name: 'Test bank' });
  return (res.body as { id: string }).id;
}

async function createAccount(
  mutate: SignedInFixture['mutate'],
  bankId: string,
  initialBalance?: number,
): Promise<string> {
  const res = await mutate('post', '/accounts', {
    bankId,
    name: 'Checking',
    currency: 'EUR',
    initialBalance,
  });
  return (res.body as { account: { id: string } }).account.id;
}

describe('operations', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /operations', () => {
    it('creates a debit operation with the amount scaled to minor units', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const categoryId = await debitCategoryId(app);

      const res = await mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Grocery store',
        amount: 42.5,
        categoryId,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      });
      expect(res.status).toBe(200);
      const { operation: created } = res.body as {
        operation: { id: string };
      };

      const [row] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.id, created.id));
      expect(row.debit).toBe(toMinorUnits(42.5));
      expect(row.credit).toBeNull();
    });

    it('creates a credit operation', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      const res = await mutate('post', '/operations', {
        accountId,
        type: 'credit',
        thirdParty: 'Employer',
        amount: 1500,
        categoryId: SALARY_CATEGORY_SEED_ID,
        paymentMethodId: PAYMENT_METHOD_ID.DEPOSIT,
      });
      expect(res.status).toBe(200);
      const { operation: created } = res.body as {
        operation: { id: string };
      };
      const [row] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.id, created.id));
      expect(row.credit).toBe(toMinorUnits(1500));
    });

    it('rejects a payment method whose type does not match', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      // CREDIT_CARD is a debit-type payment method.
      const res = await mutate('post', '/operations', {
        accountId,
        type: 'credit',
        thirdParty: 'Mismatch',
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      });
      expect(res.status).toBe(400);
    });

    it('rejects a category whose type does not match', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      // Salary is a credit-type category.
      const res = await mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Mismatch',
        amount: 10,
        categoryId: SALARY_CATEGORY_SEED_ID,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      });
      expect(res.status).toBe(400);
    });

    it("404s creating an operation under another member's account", async () => {
      const { mutate: ownerMutate } = await seedSignedInMember(app);
      const bankId = await createBank(ownerMutate);
      const accountId = await createAccount(ownerMutate, bankId);

      const { mutate: attackerMutate } = await seedSignedInMember(app);
      const res = await attackerMutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Stolen',
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      });
      expect(res.status).toBe(404);
    });

    it('rejects creating an operation on a closed account', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      await mutate('post', `/accounts/${accountId}/close`);

      const res = await mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Nope',
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /operations', () => {
    it('paginates and 404s for a foreign account', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      for (let i = 0; i < 3; i++) {
        await mutate('post', '/operations', {
          accountId,
          type: 'debit',
          thirdParty: `Third party ${i}`,
          amount: 5,
          paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        });
      }

      const res = await agent
        .get(`/operations?accountId=${accountId}&page=1`)
        .expect(200);
      const body = res.body as { items: unknown[]; total: number };
      expect(body.total).toBe(3);
      expect(body.items).toHaveLength(3);

      const { agent: attackerAgent } = await seedSignedInMember(app);
      await attackerAgent
        .get(`/operations?accountId=${accountId}&page=1`)
        .expect(404);
    });
  });

  describe('PATCH /operations/:id', () => {
    it('updates thirdParty and amount', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const created = await mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Old',
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-01-01',
      });
      const { id } = (created.body as { operation: { id: string } }).operation;

      const res = await mutate('patch', `/operations/${id}`, {
        accountId,
        type: 'debit',
        thirdParty: 'New',
        amount: 20,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-01-02',
      });
      expect(res.status).toBe(200);

      const [row] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.id, id));
      expect(row.thirdParty).toBe('New');
      expect(row.debit).toBe(toMinorUnits(20));
    });

    it('rejects moving an operation to a different account', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const otherAccountId = await createAccount(mutate, bankId);
      const created = await mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Old',
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-01-01',
      });
      const { id } = (created.body as { operation: { id: string } }).operation;

      const res = await mutate('patch', `/operations/${id}`, {
        accountId: otherAccountId,
        type: 'debit',
        thirdParty: 'Old',
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-01-01',
      });
      expect(res.status).toBe(400);
    });

    it('rejects editing the system-generated opening operation', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId, 100);
      const [opening] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.accountId, accountId));

      const res = await mutate('patch', `/operations/${opening.id}`, {
        accountId,
        type: 'credit',
        thirdParty: 'Initial balance',
        amount: 200,
        paymentMethodId: PAYMENT_METHOD_ID.INITIAL_BALANCE,
        valueDate: '2026-01-01',
      });
      expect(res.status).toBe(422);
    });

    it('rejects editing an operation on a now-closed account', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const created = await mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Old',
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-01-01',
      });
      const { id } = (created.body as { operation: { id: string } }).operation;
      await mutate('post', `/accounts/${accountId}/close`);

      const res = await mutate('patch', `/operations/${id}`, {
        accountId,
        type: 'debit',
        thirdParty: 'Old',
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-01-01',
      });
      expect(res.status).toBe(422);
    });
  });
});
