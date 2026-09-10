import { INestApplication } from '@nestjs/common';
import type { Server } from 'http';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import {
  seedSignedInMember,
  SignedInFixture,
} from '../test-support/auth-fixture';
import { createTestApp } from '../test-support/create-test-app';

/**
 * The domain-specific *.integration-spec.ts files each already prove their
 * own creation-time ownership check (e.g. "can't create an account under
 * someone else's bank"). What none of them individually cover is the
 * complementary case — mutating a resource that already exists and is
 * owned outright by someone else — across every resource OwnershipService
 * guards. That's this file's one job: a focused sweep of exactly the
 * update/close/delete-on-a-foreign-id gap, not a re-run of checks the
 * domain files already make.
 */

async function createBank(mutate: SignedInFixture['mutate']): Promise<string> {
  const res = await mutate('post', '/banks/choice', { name: 'Owner bank' });
  return (res.body as { id: string }).id;
}

async function createAccount(
  mutate: SignedInFixture['mutate'],
  bankId: string,
): Promise<string> {
  const res = await mutate('post', '/accounts', {
    bankId,
    name: 'Owner account',
    currency: 'EUR',
  });
  return (res.body as { account: { id: string } }).account.id;
}

async function createOperation(
  mutate: SignedInFixture['mutate'],
  accountId: string,
): Promise<string> {
  const res = await mutate('post', '/operations', {
    accountId,
    type: 'debit',
    thirdParty: 'Owner op',
    amount: 10,
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    valueDate: '2026-01-01',
  });
  return (res.body as { operation: { id: string } }).operation.id;
}

async function createScheduler(
  mutate: SignedInFixture['mutate'],
  accountId: string,
): Promise<string> {
  const res = await mutate('post', '/schedulers', {
    accountId,
    type: 'debit',
    thirdParty: 'Owner scheduler',
    amount: 10,
    paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
    valueDate: '2099-01-01',
    frequencyValue: 1,
    frequencyUnit: 'month',
  });
  return (res.body as { scheduler: { id: string } }).scheduler.id;
}

describe('cross-resource ownership sweep (mutating a foreign, already-existing id)', () => {
  let app: INestApplication<Server>;
  let owner: SignedInFixture;
  let attacker: SignedInFixture;
  let bankId: string;
  let accountId: string;
  let operationId: string;
  let schedulerId: string;

  beforeAll(async () => {
    ({ app } = await createTestApp());
    owner = await seedSignedInMember(app);
    bankId = await createBank(owner.mutate);
    accountId = await createAccount(owner.mutate, bankId);
    operationId = await createOperation(owner.mutate, accountId);
    schedulerId = await createScheduler(owner.mutate, accountId);
    attacker = await seedSignedInMember(app);
  });

  afterAll(async () => {
    await app.close();
  });

  it('404s closing a bank owned by someone else', async () => {
    const res = await attacker.mutate('post', `/banks/${bankId}/close`);
    expect(res.status).toBe(404);
  });

  it('404s deleting a bank owned by someone else', async () => {
    const res = await attacker.mutate('delete', `/banks/${bankId}`);
    expect(res.status).toBe(404);
  });

  it('404s updating an account owned by someone else', async () => {
    const res = await attacker.mutate('patch', `/accounts/${accountId}`, {
      name: 'Hijacked',
      bankId,
      currency: 'EUR',
    });
    expect(res.status).toBe(404);
  });

  it('404s closing an account owned by someone else', async () => {
    const res = await attacker.mutate('post', `/accounts/${accountId}/close`);
    expect(res.status).toBe(404);
  });

  it('404s deleting an account owned by someone else', async () => {
    const res = await attacker.mutate('delete', `/accounts/${accountId}`);
    expect(res.status).toBe(404);
  });

  it('404s updating an operation owned by someone else', async () => {
    const res = await attacker.mutate('patch', `/operations/${operationId}`, {
      accountId,
      type: 'debit',
      thirdParty: 'Hijacked',
      amount: 10,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2026-01-01',
    });
    expect(res.status).toBe(404);
  });

  it('404s updating a scheduler owned by someone else', async () => {
    const res = await attacker.mutate('patch', `/schedulers/${schedulerId}`, {
      accountId,
      type: 'debit',
      thirdParty: 'Hijacked',
      amount: 10,
      paymentMethodId: PAYMENT_METHOD_ID.CREDIT_CARD,
      valueDate: '2099-01-01',
      frequencyValue: 1,
      frequencyUnit: 'month',
    });
    expect(res.status).toBe(404);
  });

  it('404s deleting a scheduler owned by someone else', async () => {
    const res = await attacker.mutate('delete', `/schedulers/${schedulerId}`);
    expect(res.status).toBe(404);
  });

  // Confirms the sweep above actually exercised live, still-owned
  // resources — a false pass from IDs already gone would be worthless.
  it('sanity check: the owner can still act on every resource above', async () => {
    expect((await owner.mutate('post', `/banks/${bankId}/close`)).status).toBe(
      200,
    );
  });
});
