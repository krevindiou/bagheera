import { ConfigModule } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { sql } from 'drizzle-orm';
import { MinorUnits } from '../common/money';
import { DbModule } from '../db/db.module';
import {
  account,
  bank,
  member,
  operation,
  report,
  scheduler,
  securityEvent,
} from '../db/schema';
import {
  connectIntegrationDb,
  IntegrationDb,
} from '../db/test-utils/integration-db';
import { SecurityModule } from './security.module';
import { OwnershipService } from './ownership.service';

// Exercises the join/edge-case behaviour of each `requireOwned*`/
// `filterOwned*` method directly against Postgres — the predicate
// combinations (owner vs. non-owner, deleted vs. closed, at each depth of
// the bank→account(→operation/scheduler) chain) that used to be re-proven
// independently in account/operation/scheduler/bank/report/chart's own
// integration specs. Those specs keep one route-level case each, to prove
// their controller still wires ownership checking in at all; the exhaustive
// combinatorics live here, once per chain shape.
describe('OwnershipService (integration)', () => {
  let moduleRef: TestingModule;
  let ownership: OwnershipService;
  let ctx: IntegrationDb;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        DbModule,
        SecurityModule,
      ],
    }).compile();

    ownership = moduleRef.get(OwnershipService);
    ctx = connectIntegrationDb();
  });

  afterAll(async () => {
    await ctx.pool.end();
    // Unlike every other *.integration-spec.ts file here, this one never
    // calls createNestApplication()/app.close() — there's no HTTP surface
    // to test, just the service. TestingModule still needs an explicit
    // close() to run onModuleDestroy (SecurityModule's rate-limit Valkey
    // client, notably) — skipping it is exactly the leak this suite's
    // sibling fix (SecurityModule.onModuleDestroy) was chasing.
    await moduleRef.close();
  });

  beforeEach(async () => {
    await ctx.db.execute(
      sql`truncate table ${securityEvent} restart identity cascade`,
    );
    await ctx.db.execute(
      sql`truncate table ${report} restart identity cascade`,
    );
    await ctx.db.execute(
      sql`truncate table ${scheduler} restart identity cascade`,
    );
    await ctx.db.execute(
      sql`truncate table ${operation} restart identity cascade`,
    );
    await ctx.db.execute(
      sql`truncate table ${account} restart identity cascade`,
    );
    await ctx.db.execute(sql`truncate table ${bank} restart identity cascade`);
    await ctx.db.execute(
      sql`truncate table ${member} restart identity cascade`,
    );
  });

  async function createMember(email: string) {
    const [row] = await ctx.db
      .insert(member)
      .values({ email, password: 'x', country: 'FR', active: true })
      .returning();
    return row;
  }

  async function createBank(
    memberId: number,
    overrides: Partial<typeof bank.$inferInsert> = {},
  ) {
    const [row] = await ctx.db
      .insert(bank)
      .values({ memberId, name: 'Bank', ...overrides })
      .returning();
    return row;
  }

  async function createAccount(
    bankId: number,
    overrides: Partial<typeof account.$inferInsert> = {},
  ) {
    const [row] = await ctx.db
      .insert(account)
      .values({ bankId, name: 'Account', currency: 'USD', ...overrides })
      .returning();
    return row;
  }

  describe('requireOwnedBank', () => {
    it('returns the row for its owner, closed/deleted included — not folded here', async () => {
      const owner = await createMember('bank-owner@example.com');
      const row = await createBank(owner.id, { closed: true, deleted: true });

      const result = await ownership.requireOwnedBank(row.id, owner.id);
      expect(result.id).toBe(row.id);
      expect(result.closed).toBe(true);
      expect(result.deleted).toBe(true);
    });

    it('404s for a non-owner regardless of closed/deleted state', async () => {
      const owner = await createMember('bank-owner2@example.com');
      const intruder = await createMember('bank-intruder2@example.com');
      const row = await createBank(owner.id);

      await expect(
        ownership.requireOwnedBank(row.id, intruder.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for an unknown id', async () => {
      const owner = await createMember('bank-owner3@example.com');
      await expect(
        ownership.requireOwnedBank(999999, owner.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requireOwnedAccount', () => {
    it('returns {account, bank} for an active owned account', async () => {
      const owner = await createMember('acct-owner@example.com');
      const b = await createBank(owner.id);
      const a = await createAccount(b.id);

      const result = await ownership.requireOwnedAccount(a.id, owner.id);
      expect(result.account.id).toBe(a.id);
      expect(result.bank.id).toBe(b.id);
    });

    it('does not fold closed into the throw — a closed account/bank is still returned', async () => {
      const owner = await createMember('acct-owner-closed@example.com');
      const b = await createBank(owner.id, { closed: true });
      const a = await createAccount(b.id, { closed: true });

      const result = await ownership.requireOwnedAccount(a.id, owner.id);
      expect(result.account.closed).toBe(true);
      expect(result.bank.closed).toBe(true);
    });

    it('404s when the account itself is deleted, even for the owner', async () => {
      const owner = await createMember('acct-owner-deleted@example.com');
      const b = await createBank(owner.id);
      const a = await createAccount(b.id, { deleted: true });

      await expect(
        ownership.requireOwnedAccount(a.id, owner.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s when only the parent bank is deleted, even for the owner', async () => {
      const owner = await createMember('acct-owner-bank-deleted@example.com');
      const b = await createBank(owner.id, { deleted: true });
      const a = await createAccount(b.id);

      await expect(
        ownership.requireOwnedAccount(a.id, owner.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for a non-owner regardless of closed/deleted state', async () => {
      const owner = await createMember('acct-owner-x@example.com');
      const intruder = await createMember('acct-intruder-x@example.com');
      const b = await createBank(owner.id);
      const a = await createAccount(b.id, { closed: true, deleted: true });

      await expect(
        ownership.requireOwnedAccount(a.id, intruder.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requireOwnedOperation', () => {
    it('returns {operation, account, bank} for an owned operation', async () => {
      const owner = await createMember('op-owner@example.com');
      const b = await createBank(owner.id);
      const a = await createAccount(b.id);
      const [op] = await ctx.db
        .insert(operation)
        .values({
          accountId: a.id,
          paymentMethodId: 1,
          thirdParty: 'Shop',
          debit: 1000 as MinorUnits,
        })
        .returning();

      const result = await ownership.requireOwnedOperation(op.id, owner.id);
      expect(result.operation.id).toBe(op.id);
      expect(result.account.id).toBe(a.id);
      expect(result.bank.id).toBe(b.id);
    });

    it('404s when reachable only through a deleted account', async () => {
      const owner = await createMember('op-owner-deleted@example.com');
      const b = await createBank(owner.id);
      const a = await createAccount(b.id, { deleted: true });
      const [op] = await ctx.db
        .insert(operation)
        .values({
          accountId: a.id,
          paymentMethodId: 1,
          thirdParty: 'Shop',
          debit: 1000 as MinorUnits,
        })
        .returning();

      await expect(
        ownership.requireOwnedOperation(op.id, owner.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for a non-owner', async () => {
      const owner = await createMember('op-owner-y@example.com');
      const intruder = await createMember('op-intruder-y@example.com');
      const b = await createBank(owner.id);
      const a = await createAccount(b.id);
      const [op] = await ctx.db
        .insert(operation)
        .values({
          accountId: a.id,
          paymentMethodId: 1,
          thirdParty: 'Shop',
          debit: 1000 as MinorUnits,
        })
        .returning();

      await expect(
        ownership.requireOwnedOperation(op.id, intruder.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requireOwnedScheduler', () => {
    it('returns {scheduler, account, bank} for an owned scheduler', async () => {
      const owner = await createMember('sch-owner@example.com');
      const b = await createBank(owner.id);
      const a = await createAccount(b.id);
      const [sch] = await ctx.db
        .insert(scheduler)
        .values({
          accountId: a.id,
          paymentMethodId: 1,
          thirdParty: 'Rent',
          debit: 1000 as MinorUnits,
          valueDate: '2026-01-01',
          frequencyValue: 1,
        })
        .returning();

      const result = await ownership.requireOwnedScheduler(sch.id, owner.id);
      expect(result.scheduler.id).toBe(sch.id);
      expect(result.account.id).toBe(a.id);
      expect(result.bank.id).toBe(b.id);
    });

    it('404s when reachable only through a deleted bank', async () => {
      const owner = await createMember('sch-owner-deleted@example.com');
      const b = await createBank(owner.id, { deleted: true });
      const a = await createAccount(b.id);
      const [sch] = await ctx.db
        .insert(scheduler)
        .values({
          accountId: a.id,
          paymentMethodId: 1,
          thirdParty: 'Rent',
          debit: 1000 as MinorUnits,
          valueDate: '2026-01-01',
          frequencyValue: 1,
        })
        .returning();

      await expect(
        ownership.requireOwnedScheduler(sch.id, owner.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for a non-owner', async () => {
      const owner = await createMember('sch-owner-z@example.com');
      const intruder = await createMember('sch-intruder-z@example.com');
      const b = await createBank(owner.id);
      const a = await createAccount(b.id);
      const [sch] = await ctx.db
        .insert(scheduler)
        .values({
          accountId: a.id,
          paymentMethodId: 1,
          thirdParty: 'Rent',
          debit: 1000 as MinorUnits,
          valueDate: '2026-01-01',
          frequencyValue: 1,
        })
        .returning();

      await expect(
        ownership.requireOwnedScheduler(sch.id, intruder.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('requireOwnedReport', () => {
    it('returns the row for its owner — no bank/account chain involved', async () => {
      const owner = await createMember('rpt-owner@example.com');
      const [rpt] = await ctx.db
        .insert(report)
        .values({
          memberId: owner.id,
          type: 'sum',
          title: 'R',
          periodGrouping: 'month',
        })
        .returning();

      const result = await ownership.requireOwnedReport(rpt.id, owner.id);
      expect(result.id).toBe(rpt.id);
    });

    it('404s for a non-owner', async () => {
      const owner = await createMember('rpt-owner2@example.com');
      const intruder = await createMember('rpt-intruder2@example.com');
      const [rpt] = await ctx.db
        .insert(report)
        .values({
          memberId: owner.id,
          type: 'sum',
          title: 'R',
          periodGrouping: 'month',
        })
        .returning();

      await expect(
        ownership.requireOwnedReport(rpt.id, intruder.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('404s for an unknown id', async () => {
      const owner = await createMember('rpt-owner3@example.com');
      await expect(
        ownership.requireOwnedReport(999999, owner.id),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('filterOwnedOperationIds', () => {
    it('keeps only active-owned ids, dropping foreign/closed/deleted/unknown', async () => {
      const owner = await createMember('filt-op-owner@example.com');
      const intruder = await createMember('filt-op-intruder@example.com');
      const activeBank = await createBank(owner.id);
      const activeAccount = await createAccount(activeBank.id);
      const closedAccount = await createAccount(activeBank.id, {
        closed: true,
      });
      const deletedBank = await createBank(owner.id, { deleted: true });
      const deletedBankAccount = await createAccount(deletedBank.id);
      const foreignBank = await createBank(intruder.id);
      const foreignAccount = await createAccount(foreignBank.id);

      const values = {
        paymentMethodId: 1,
        thirdParty: 'X',
        debit: 1000 as MinorUnits,
      };
      const [keep, droppedClosed, droppedDeletedBank, droppedForeign] =
        await ctx.db
          .insert(operation)
          .values([
            { accountId: activeAccount.id, ...values },
            { accountId: closedAccount.id, ...values },
            { accountId: deletedBankAccount.id, ...values },
            { accountId: foreignAccount.id, ...values },
          ])
          .returning();

      const result = await ownership.filterOwnedOperationIds(
        [
          keep.id,
          droppedClosed.id,
          droppedDeletedBank.id,
          droppedForeign.id,
          999999,
        ],
        owner.id,
      );
      expect(result).toEqual([keep.id]);
    });

    it('returns an empty array for an empty input without querying', async () => {
      const owner = await createMember('filt-op-empty@example.com');
      expect(await ownership.filterOwnedOperationIds([], owner.id)).toEqual([]);
    });
  });

  describe('filterOwnedSchedulerIds', () => {
    it('keeps only active-owned ids, dropping foreign/closed/deleted/unknown', async () => {
      const owner = await createMember('filt-sch-owner@example.com');
      const intruder = await createMember('filt-sch-intruder@example.com');
      const activeBank = await createBank(owner.id);
      const activeAccount = await createAccount(activeBank.id);
      const closedAccount = await createAccount(activeBank.id, {
        closed: true,
      });
      const foreignBank = await createBank(intruder.id);
      const foreignAccount = await createAccount(foreignBank.id);

      const values = {
        paymentMethodId: 1,
        thirdParty: 'X',
        debit: 1000 as MinorUnits,
        valueDate: '2026-01-01',
        frequencyValue: 1,
      };
      const [keep, droppedClosed, droppedForeign] = await ctx.db
        .insert(scheduler)
        .values([
          { accountId: activeAccount.id, ...values },
          { accountId: closedAccount.id, ...values },
          { accountId: foreignAccount.id, ...values },
        ])
        .returning();

      const result = await ownership.filterOwnedSchedulerIds(
        [keep.id, droppedClosed.id, droppedForeign.id, 999999],
        owner.id,
      );
      expect(result).toEqual([keep.id]);
    });
  });

  describe('filterOwnedReportIds', () => {
    it('keeps only owned ids, dropping foreign/unknown', async () => {
      const owner = await createMember('filt-rpt-owner@example.com');
      const intruder = await createMember('filt-rpt-intruder@example.com');
      const values = {
        type: 'sum' as const,
        title: 'R',
        periodGrouping: 'month' as const,
      };
      const [keep] = await ctx.db
        .insert(report)
        .values({ memberId: owner.id, ...values })
        .returning();
      const [foreign] = await ctx.db
        .insert(report)
        .values({ memberId: intruder.id, ...values })
        .returning();

      const result = await ownership.filterOwnedReportIds(
        [keep.id, foreign.id, 999999],
        owner.id,
      );
      expect(result).toEqual([keep.id]);
    });
  });
});
