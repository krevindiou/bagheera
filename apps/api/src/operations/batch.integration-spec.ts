import { INestApplication } from '@nestjs/common';
import { and, desc, eq } from 'drizzle-orm';
import { operation, securityEvent } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import {
  seedSignedInMember,
  SignedInFixture,
} from '../test-support/auth-fixture';
import { createTestApp, getDb } from '../test-support/create-test-app';

async function createBank(mutate: SignedInFixture['mutate']): Promise<string> {
  const res = await mutate('post', '/banks/choice', { name: 'Test bank' });
  return (res.body as { id: string }).id;
}

async function createAccount(
  mutate: SignedInFixture['mutate'],
  bankId: string,
): Promise<string> {
  const res = await mutate('post', '/accounts', {
    bankId,
    name: 'Account',
    currency: 'EUR',
  });
  return (res.body as { account: { id: string } }).account.id;
}

async function createOperation(
  mutate: SignedInFixture['mutate'],
  accountId: string,
  overrides: { transferAccountId?: string } = {},
): Promise<string> {
  const res = await mutate('post', '/operations', {
    accountId,
    type: 'debit',
    thirdParty: 'X',
    amount: 10,
    paymentMethodId: overrides.transferAccountId
      ? PAYMENT_METHOD_ID.TRANSFER_DEBIT
      : PAYMENT_METHOD_ID.CREDIT_CARD,
    transferAccountId: overrides.transferAccountId,
    valueDate: '2026-01-01',
  });
  return (res.body as { operation: { id: string } }).operation.id;
}

describe('operations batch actions', () => {
  let app: INestApplication;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /operations/batch/delete', () => {
    it('deletes only owned ids and records operation_batch_deleted', async () => {
      const { mutate, memberId } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const ownId = await createOperation(mutate, accountId);

      const { mutate: otherMutate } = await seedSignedInMember(app);
      const otherBankId = await createBank(otherMutate);
      const otherAccountId = await createAccount(otherMutate, otherBankId);
      const foreignId = await createOperation(otherMutate, otherAccountId);

      const res = await mutate('post', '/operations/batch/delete', {
        ids: [ownId, foreignId],
      });
      expect(res.status).toBe(200);
      expect((res.body as { deletedCount: number }).deletedCount).toBe(1);

      const remaining = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.id, ownId));
      expect(remaining).toHaveLength(0);
      const foreignStillThere = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.id, foreignId));
      expect(foreignStillThere).toHaveLength(1);

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'operation_batch_deleted'),
            eq(securityEvent.memberId, memberId),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });

    it('converts a survivor transfer mirror to External when its counterpart is batch-deleted', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountA = await createAccount(mutate, bankId);
      const accountB = await createAccount(mutate, bankId);
      const sourceId = await createOperation(mutate, accountA, {
        transferAccountId: accountB,
      });
      const [source] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.id, sourceId));
      const mirrorId = source.transferOperationId!;

      await mutate('post', '/operations/batch/delete', { ids: [sourceId] });

      const [mirror] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.id, mirrorId));
      expect(mirror).toBeDefined();
      expect(mirror.transferAccountId).toBeNull();
      expect(mirror.transferOperationId).toBeNull();
    });

    it('drops ids on a closed account rather than deleting them', async () => {
      const { mutate } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const opId = await createOperation(mutate, accountId);
      await mutate('post', `/accounts/${accountId}/close`);

      const res = await mutate('post', '/operations/batch/delete', {
        ids: [opId],
      });
      expect((res.body as { deletedCount: number }).deletedCount).toBe(0);

      const stillThere = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.id, opId));
      expect(stillThere).toHaveLength(1);
    });
  });

  describe('POST /operations/batch/reconcile', () => {
    it('reconciles only owned ids and records operation_batch_reconciled', async () => {
      const { mutate, memberId } = await seedSignedInMember(app);
      const bankId = await createBank(mutate);
      const accountId = await createAccount(mutate, bankId);
      const opId = await createOperation(mutate, accountId);

      const res = await mutate('post', '/operations/batch/reconcile', {
        ids: [opId],
      });
      expect(res.status).toBe(200);
      expect((res.body as { reconciledCount: number }).reconciledCount).toBe(1);

      const [row] = await getDb(app)
        .select()
        .from(operation)
        .where(eq(operation.id, opId));
      expect(row.reconciled).toBe(true);

      const [event] = await getDb(app)
        .select()
        .from(securityEvent)
        .where(
          and(
            eq(securityEvent.eventType, 'operation_batch_reconciled'),
            eq(securityEvent.memberId, memberId),
          ),
        )
        .orderBy(desc(securityEvent.createdAt))
        .limit(1);
      expect(event).toBeDefined();
    });
  });
});
