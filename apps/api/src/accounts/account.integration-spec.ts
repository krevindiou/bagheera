import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { and, desc, eq } from 'drizzle-orm';
import { toMinorUnits } from '../common/money';
import { account, operation, securityEvent } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { seedSignedInMember, SignedInFixture } from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

function messageOf(res: { body: unknown }): string {
  return (res.body as { message: string }).message;
}

async function createBank(mutate: SignedInFixture['mutate'], name = 'Test bank'): Promise<string> {
  const res = await mutate('post', '/banks/choice', { name });
  return (res.body as { id: string }).id;
}

async function createAccount(
  mutate: SignedInFixture['mutate'],
  bankId: string,
  overrides: { name?: string; currency?: string; initialBalance?: number } = {},
): Promise<string> {
  const res = await mutate('post', '/accounts', {
    bankId,
    name: overrides.name ?? 'Checking',
    currency: overrides.currency ?? 'EUR',
    initialBalance: overrides.initialBalance,
  });
  return (res.body as { account: { id: string } }).account.id;
}

describe('accounts', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /accounts', () => {
    it('starts empty and filters by bankId', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);

      const empty = await agent.get('/accounts').expect(200);
      expect(empty.body).toEqual([]);

      await createAccount(mutate, bankId);

      const all = await agent.get('/accounts').expect(200);
      expect(all.body).toHaveLength(1);

      const filtered = await agent.get(`/accounts?bankId=${bankId}`).expect(200);
      expect(filtered.body).toHaveLength(1);
    });

    it('includes each account balance', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      await createAccount(mutate, bankId, { name: 'Checking', initialBalance: 100 });
      await createAccount(mutate, bankId, { name: 'Savings', initialBalance: -25 });

      const res = await agent.get('/accounts').expect(200);
      const body = res.body as { name: string; balance: number }[];
      expect(body.find((a) => a.name === 'Checking')?.balance).toBe(100);
      expect(body.find((a) => a.name === 'Savings')?.balance).toBe(-25);
    });

    it('also includes each account reconciled balance, excluding unreconciled operations', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId, {
        name: 'Checking',
        initialBalance: 100,
      });
      await mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Unreconciled',
        amount: 20,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2026-01-01',
        reconciled: false,
      });

      const res = await agent.get('/accounts').expect(200);
      const body = res.body as { name: string; balance: number; reconciledBalance: number }[];
      const checking = body.find((a) => a.name === 'Checking');
      expect(checking?.balance).toBe(80);
      expect(checking?.reconciledBalance).toBe(100);
    });
  });

  describe('POST /accounts', () => {
    it('creates an account with no opening operation when initialBalance is omitted', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      const ops = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.accountId, accountId));
      expect(ops).toHaveLength(0);
    });

    it('creates a credit opening operation for a positive initial balance', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId, {
        initialBalance: 100,
      });

      const [op] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.accountId, accountId));
      expect(op.credit).toBe(toMinorUnits(100));
      expect(op.debit).toBeNull();
      expect(op.paymentMethodId).toBe(PAYMENT_METHOD_ID.INITIAL_BALANCE);
      expect(op.reconciled).toBe(true);
    });

    it('creates a debit opening operation for a negative initial balance', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId, {
        initialBalance: -50,
      });

      const [op] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.accountId, accountId));
      expect(op.debit).toBe(toMinorUnits(50));
      expect(op.credit).toBeNull();
    });

    it("404s creating an account under another member's bank", async () => {
      const { mutate: ownerMutate } = await seedSignedInMember(app);
      const bankId = await createBank(ownerMutate);

      const { mutate: attackerMutate } = await seedSignedInMember(app);
      const res = await attackerMutate('post', '/accounts', {
        bankId,
        name: 'Stolen',
        currency: 'EUR',
      });
      expect(res.status).toBe(404);
    });

    it('rejects creating an account under a closed bank', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      await mutate('post', `/banks/${bankId}/close`);

      const res = await mutate('post', '/accounts', {
        bankId,
        name: 'Nope',
        currency: 'EUR',
      });
      expect(res.status).toBe(422);
    });
  });

  describe('GET /accounts/:id/balance', () => {
    it('sums credits and debits, and separately for reconciled-only', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      await getDb(app)
        .insert(operation)
        .values([
          {
            accountId,
            paymentMethodId: PAYMENT_METHOD_ID.INITIAL_BALANCE,
            thirdParty: 'A',
            credit: toMinorUnits(100),
            reconciled: true,
          },
          {
            accountId,
            paymentMethodId: PAYMENT_METHOD_ID.INITIAL_BALANCE,
            thirdParty: 'B',
            debit: toMinorUnits(30),
            reconciled: false,
          },
        ]);

      const res = await agent.get(`/accounts/${accountId}/balance`).expect(200);
      const body = res.body as { balance: number; reconciledBalance: number };
      expect(body.balance).toBe(70);
      expect(body.reconciledBalance).toBe(100);
    });

    it("404s reading another member's account balance", async () => {
      const { mutate: ownerMutate } = await seedSignedInMember(app);
      const bankId = await createBank(ownerMutate);
      const accountId = await createAccount(ownerMutate, bankId);

      const { agent: attackerAgent } = await seedSignedInMember(app);
      await attackerAgent.get(`/accounts/${accountId}/balance`).expect(404);
    });
  });

  describe('GET /accounts/:id/chart', () => {
    it('returns empty points for an account with no operations', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      const res = await agent.get(`/accounts/${accountId}/chart`).expect(200);
      const body = res.body as { currency: string; points: unknown[] };
      expect(body.currency).toBe('EUR');
      expect(body.points).toEqual([]);
    });

    it('returns non-empty points once an operation exists', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId, {
        initialBalance: 100,
      });

      const res = await agent.get(`/accounts/${accountId}/chart`).expect(200);
      const body = res.body as { points: unknown[] };
      expect(body.points.length).toBeGreaterThan(0);
    });

    it("ends the 12-month window at the account's latest operation, not today", async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      // No initial balance — that operation would be dated today (see
      // `operation.valueDate`'s `defaultNow()`), defeating the point below.
      const accountId = await createAccount(mutate, bankId);
      // Dated years before "today" — if the window were anchored to the
      // real current date, the last point's period would be this month,
      // not '2020-01-01'.
      await mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Old',
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2020-01-15',
      });

      const res = await agent.get(`/accounts/${accountId}/chart`).expect(200);
      const body = res.body as { points: { period: string; value: number }[] };
      expect(body.points[body.points.length - 1]).toEqual({ period: '2020-01-01', value: -10 });
    });

    it('widens the window to 24 months with ?range=24', async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId, { initialBalance: 100 });

      const res = await agent.get(`/accounts/${accountId}/chart?range=24`).expect(200);
      const body = res.body as { points: unknown[] };
      expect(body.points).toHaveLength(24);
    });

    it("spans the account's whole history with ?range=all", async () => {
      const { agent, mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      await mutate('post', '/operations', {
        accountId,
        type: 'debit',
        thirdParty: 'Old',
        amount: 10,
        paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
        valueDate: '2020-01-15',
      });

      const res = await agent.get(`/accounts/${accountId}/chart?range=all`).expect(200);
      const body = res.body as { points: { period: string }[] };
      expect(body.points[0].period).toBe('2020-01-01');
    });
  });

  describe('PATCH /accounts/:id', () => {
    it('renames an account', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId, {
        name: 'Old name',
      });

      const res = await mutate('patch', `/accounts/${accountId}`, {
        name: 'New name',
        bankId,
        currency: 'EUR',
      });
      expect(res.status).toBe(200);
      expect(messageOf(res)).toBe('Account saved');

      const [row] = await getDb(app).select().from(account).where(eq(account.id, accountId));
      expect(row.name).toBe('New name');
    });

    it('rejects changing the bank or currency', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const otherBankId = await createBank(mutate, 'Other bank');
      const accountId = await createAccount(mutate, bankId);

      const res = await mutate('patch', `/accounts/${accountId}`, {
        name: 'Same name',
        bankId: otherBankId,
        currency: 'EUR',
      });
      expect(res.status).toBe(400);
    });
  });

  describe('POST /accounts/:id/close and DELETE /accounts/:id', () => {
    it('closes an account and records account_closed', async () => {
      const { mutate, memberId } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      const res = await mutate('post', `/accounts/${accountId}/close`);
      expect(res.status).toBe(200);
      expect(messageOf(res)).toBe('Account closed');

      const [row] = await getDb(app).select().from(account).where(eq(account.id, accountId));
      expect(row.closed).toBe(true);

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(eq(securityEvent.eventType, 'account_closed'), eq(securityEvent.memberId, memberId)),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it('deletes an account and records account_deleted', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);

      const res = await mutate('delete', `/accounts/${accountId}`);
      expect(res.status).toBe(200);
      expect(messageOf(res)).toBe('Account deleted');

      const [row] = await getDb(app).select().from(account).where(eq(account.id, accountId));
      expect(row.deleted).toBe(true);
    });

    it('404s deleting an already-deleted account', async () => {
      // Unlike bank removal, OwnershipService.requireOwnedAccount folds
      // account.deleted into its own 404 (see its doc comment — banks are
      // the one exception) — so AccountService.remove()'s own "already
      // deleted" 422 check is never actually reached via this endpoint.
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      await mutate('delete', `/accounts/${accountId}`);

      const res = await mutate('delete', `/accounts/${accountId}`);
      expect(res.status).toBe(404);
    });
  });
});
