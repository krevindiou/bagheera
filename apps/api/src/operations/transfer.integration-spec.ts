import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { eq } from 'drizzle-orm';
import { toMinorUnits } from '../common/money';
import { operation } from '../db/schema';
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
  currency = 'EUR',
): Promise<string> {
  const res = await mutate('post', '/accounts', {
    bankId,
    name: 'Account',
    currency,
  });
  return (res.body as { account: { id: string } }).account.id;
}

async function createOperation(
  mutate: SignedInFixture['mutate'],
  accountId: string,
  overrides: {
    paymentMethodId?: string;
    transferAccountId?: string;
    amount?: number;
    thirdParty?: string;
  } = {},
): Promise<string> {
  const res = await mutate('post', '/operations', {
    accountId,
    type: 'debit',
    thirdParty: overrides.thirdParty ?? 'Transfer',
    amount: overrides.amount ?? 100,
    paymentMethodId:
      overrides.paymentMethodId ?? PAYMENT_METHOD_ID.TRANSFER_DEBIT,
    transferAccountId: overrides.transferAccountId,
    valueDate: '2026-01-01',
  });
  expect(res.status).toBe(200);
  return (res.body as { operation: { id: string } }).operation.id;
}

async function opRow(app: INestApplication<Server>, id: string) {
  const [row] = await getDb(app)
    .select()
    .from(operation)
    .where(eq(operation.id, id));
  return row;
}

describe('operation transfer pairing', () => {
  let app: INestApplication<Server>;

  beforeAll(async () => {
    ({ app } = await createTestApp());
  });

  afterAll(async () => {
    await app.close();
  });

  it('attaches a mirror operation on create, flipping payment method and debit/credit', async () => {
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountA = await createAccount(mutate, bankId);
    const accountB = await createAccount(mutate, bankId);

    const sourceId = await createOperation(mutate, accountA, {
      transferAccountId: accountB,
      amount: 75,
    });

    const source = await opRow(app, sourceId);
    expect(source.transferOperationId).not.toBeNull();
    expect(source.debit).toBe(toMinorUnits(75));

    const mirror = await opRow(app, source.transferOperationId!);
    expect(mirror.accountId).toBe(accountB);
    expect(mirror.paymentMethodId).toBe(PAYMENT_METHOD_ID.TRANSFER_CREDIT);
    expect(mirror.credit).toBe(toMinorUnits(75));
    expect(mirror.debit).toBeNull();
    expect(mirror.transferOperationId).toBe(sourceId);
    expect(mirror.transferAccountId).toBe(accountA);
  });

  it('rejects transferring to the same account', async () => {
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountA = await createAccount(mutate, bankId);

    const res = await mutate('post', '/operations', {
      accountId: accountA,
      type: 'debit',
      thirdParty: 'Self',
      amount: 10,
      paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
      transferAccountId: accountA,
      valueDate: '2026-01-01',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a transfer target with a different currency', async () => {
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountA = await createAccount(mutate, bankId, 'EUR');
    const accountB = await createAccount(mutate, bankId, 'USD');

    const res = await mutate('post', '/operations', {
      accountId: accountA,
      type: 'debit',
      thirdParty: 'Mismatch',
      amount: 10,
      paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
      transferAccountId: accountB,
      valueDate: '2026-01-01',
    });
    expect(res.status).toBe(400);
  });

  it('rejects a transfer target owned by another member', async () => {
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountA = await createAccount(mutate, bankId);

    const { mutate: otherMutate } = await seedSignedInMember(app);
    const otherBankId = await createBank(otherMutate);
    const otherAccountId = await createAccount(otherMutate, otherBankId);

    const res = await mutate('post', '/operations', {
      accountId: accountA,
      type: 'debit',
      thirdParty: 'Not yours',
      amount: 10,
      paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
      transferAccountId: otherAccountId,
      valueDate: '2026-01-01',
    });
    expect(res.status).toBe(400);
  });

  it('refreshes the mirror in place when the target is unchanged', async () => {
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountA = await createAccount(mutate, bankId);
    const accountB = await createAccount(mutate, bankId);
    const sourceId = await createOperation(mutate, accountA, {
      transferAccountId: accountB,
      amount: 50,
    });
    const before = await opRow(app, sourceId);
    const mirrorId = before.transferOperationId!;

    const res = await mutate('patch', `/operations/${sourceId}`, {
      accountId: accountA,
      type: 'debit',
      thirdParty: 'Renamed',
      amount: 60,
      paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
      transferAccountId: accountB,
      valueDate: '2026-01-01',
    });
    expect(res.status).toBe(200);

    const after = await opRow(app, sourceId);
    expect(after.transferOperationId).toBe(mirrorId);
    const mirror = await opRow(app, mirrorId);
    expect(mirror.thirdParty).toBe('Renamed');
    expect(mirror.credit).toBe(toMinorUnits(60));
  });

  it('retargets: the same mirror row moves to the new target account', async () => {
    // sync()'s 'retarget' branch updates the existing mirror's accountId in
    // place rather than delete+recreate — same mirror id survives, just
    // relocated.
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountA = await createAccount(mutate, bankId);
    const accountB = await createAccount(mutate, bankId);
    const accountC = await createAccount(mutate, bankId);
    const sourceId = await createOperation(mutate, accountA, {
      transferAccountId: accountB,
    });
    const before = await opRow(app, sourceId);
    const mirrorId = before.transferOperationId!;

    const res = await mutate('patch', `/operations/${sourceId}`, {
      accountId: accountA,
      type: 'debit',
      thirdParty: 'Transfer',
      amount: 100,
      paymentMethodId: PAYMENT_METHOD_ID.TRANSFER_DEBIT,
      transferAccountId: accountC,
      valueDate: '2026-01-01',
    });
    expect(res.status).toBe(200);

    const after = await opRow(app, sourceId);
    expect(after.transferOperationId).toBe(mirrorId);
    const mirror = await opRow(app, mirrorId);
    expect(mirror.accountId).toBe(accountC);
  });

  it('detaches: switching to a non-transfer payment method deletes the mirror and clears pairing', async () => {
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountA = await createAccount(mutate, bankId);
    const accountB = await createAccount(mutate, bankId);
    const sourceId = await createOperation(mutate, accountA, {
      transferAccountId: accountB,
    });
    const before = await opRow(app, sourceId);
    const mirrorId = before.transferOperationId!;

    const res = await mutate('patch', `/operations/${sourceId}`, {
      accountId: accountA,
      type: 'debit',
      thirdParty: 'No longer a transfer',
      amount: 100,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2026-01-01',
    });
    expect(res.status).toBe(200);

    const after = await opRow(app, sourceId);
    expect(after.transferOperationId).toBeNull();
    expect(after.transferAccountId).toBeNull();

    const mirrorRows = await getDb(app)
      .select()
      .from(operation)
      .where(eq(operation.id, mirrorId));
    expect(mirrorRows).toHaveLength(0);
  });

  it('deleting the target account converts the source to an External reference', async () => {
    const { mutate } = await seedSignedInMember(app);
    const bankId = await createBank(mutate);
    const accountA = await createAccount(mutate, bankId);
    const accountB = await createAccount(mutate, bankId);
    const sourceId = await createOperation(mutate, accountA, {
      transferAccountId: accountB,
    });

    const del = await mutate('delete', `/accounts/${accountB}`);
    expect(del.status).toBe(200);

    const after = await opRow(app, sourceId);
    expect(after.transferAccountId).toBeNull();
    expect(after.transferOperationId).toBeNull();
  });
});
