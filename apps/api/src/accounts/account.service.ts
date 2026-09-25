import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { balancesByAccount, ZERO_BALANCE } from '../common/balances';
import { AxisBounds } from '../common/chart-axis';
import { MinorUnits, toMajorUnits, toMinorUnits } from '../common/money';
import { monthlyNetByAccount, toSynthesisChartRow } from '../common/monthly-net';
import {
  computeSynthesisChart,
  latestValueDate,
  parseSynthesisChartWindow,
} from '../common/synthesis-chart';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation } from '../db/schema';
import { PAYMENT_METHOD_ID } from '../db/seed-data';
import { TransferService } from '../operations/transfer.service';
import { AuditService } from '../security/audit.service';
import { AccountId, BankId } from '../security/ids';
import { requireBelowQuota } from '../security/member-quotas';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { reachableAccountsOf } from '../security/reachable';

export interface AccountChartPoint {
  period: string;
  value: number;
}

export interface AccountChart {
  currency: string;
  axisBounds: AxisBounds | null;
  points: AccountChartPoint[];
}

// The "Initial balance" payment method, reserved for the system-generated
// opening operation.
const INITIAL_BALANCE_PAYMENT_METHOD_ID = PAYMENT_METHOD_ID.INITIAL_BALANCE;

@Injectable()
export class AccountService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly transfers: TransferService,
    private readonly audit: AuditService,
    private readonly ownership: OwnershipService,
  ) {}

  async list(req: Request, bankId?: string) {
    const memberId = requireMemberId(req);
    const conditions = [reachableAccountsOf(memberId)];
    if (bankId) {
      conditions.push(eq(account.bankId, bankId));
    }
    const rows = await this.db
      .select({ account })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(and(...conditions))
      .orderBy(asc(account.name));
    const accounts = rows.map((r) => r.account);

    // The accounts screen shows each account's running balance (and its
    // reconciled counterpart, muted/smaller — see AccountsPage.vue) next to
    // its name — one bulk aggregate query for the whole list rather than N
    // calls to the single-account `balance()` below.
    const balances = await balancesByAccount(
      this.db,
      accounts.map((a) => a.id),
    );
    return accounts.map((a) => {
      const entry = balances.get(a.id) ?? ZERO_BALANCE;
      return {
        ...a,
        balance: toMajorUnits(entry.balance),
        reconciledBalance: toMajorUnits(entry.reconciledBalance),
      };
    });
  }

  async create(req: Request, dto: CreateAccountDto) {
    const memberId = requireMemberId(req);
    const bankRow = await this.ownership.requireOwnedBank(dto.bankId as BankId, memberId);
    if (bankRow.closed || bankRow.deleted) {
      throw new UnprocessableEntityException('Bank is not active.');
    }
    requireBelowQuota('accounts', await this.ownership.countOwned('accounts', memberId));

    const minorUnits = toMinorUnits(dto.initialBalance ?? 0);
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(account)
        .values({
          bankId: dto.bankId,
          name: dto.name,
          currency: dto.currency,
        })
        .returning();

      if (minorUnits !== 0) {
        await tx.insert(operation).values({
          accountId: created.id,
          paymentMethodId: INITIAL_BALANCE_PAYMENT_METHOD_ID,
          thirdParty: 'Initial balance',
          credit: minorUnits > 0 ? minorUnits : null,
          debit: minorUnits < 0 ? (-(minorUnits as number) as MinorUnits) : null,
          reconciled: true,
        });
      }

      return created;
    });
  }

  // Cumulative end-of-month balance for a trailing window (12/24 months,
  // or the full history — see `range`) — the same synthesis chart shown on
  // the dashboard, scoped to this one account (and therefore its one
  // currency). The window ends at this account's latest operation, not
  // today (see synthesis-chart.ts's `latestValueDate`). Empty (no
  // operations at all, ever) is signalled by an empty `points` array; the
  // chart component hides itself in that case.
  async chart(req: Request, id: string, range?: string): Promise<AccountChart> {
    const memberId = requireMemberId(req);
    const { account: acc } = await this.ownership.requireOwnedAccount(id as AccountId, memberId);

    const rows = (await monthlyNetByAccount(this.db, [id])).map((row) =>
      toSynthesisChartRow(row, acc.currency),
    );

    if (rows.length === 0) {
      return { currency: acc.currency, axisBounds: null, points: [] };
    }

    const synthesis = computeSynthesisChart(
      rows,
      latestValueDate(rows),
      parseSynthesisChartWindow(range),
    );
    // Exactly one currency in scope, so exactly one series.
    const series = synthesis.series[0];

    return {
      currency: acc.currency,
      axisBounds: synthesis.axisBounds,
      points: series.points,
    };
  }

  // Balance: sum of credits minus sum of debits over all the account's
  // operations. Reconciled balance: same computation restricted to
  // reconciled operations.
  async balance(req: Request, id: string): Promise<{ balance: number; reconciledBalance: number }> {
    const memberId = requireMemberId(req);
    await this.ownership.requireOwnedAccount(id as AccountId, memberId);

    const entry = (await balancesByAccount(this.db, [id])).get(id) ?? ZERO_BALANCE;
    return {
      balance: toMajorUnits(entry.balance),
      reconciledBalance: toMajorUnits(entry.reconciledBalance),
    };
  }

  async update(req: Request, id: string, dto: UpdateAccountDto): Promise<void> {
    const memberId = requireMemberId(req);
    const { account: row } = await this.ownership.requireOwnedAccount(id as AccountId, memberId);
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Account is not active.');
    }
    if (dto.bankId !== row.bankId || dto.currency !== row.currency) {
      throw new BadRequestException('Bank and currency cannot be changed.');
    }
    await this.db.update(account).set({ name: dto.name }).where(eq(account.id, id));
  }

  async close(req: Request, id: string): Promise<void> {
    const memberId = requireMemberId(req);
    const { account: row } = await this.ownership.requireOwnedAccount(id as AccountId, memberId);
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Account is not active.');
    }
    await this.db.update(account).set({ closed: true }).where(eq(account.id, id));
    await this.audit.record('account_closed', memberId, req.ip ?? 'unknown');
  }

  async remove(req: Request, id: string): Promise<void> {
    const memberId = requireMemberId(req);
    const { account: row } = await this.ownership.requireOwnedAccount(id as AccountId, memberId);
    if (row.deleted) {
      throw new UnprocessableEntityException('Account is already deleted.');
    }
    await this.db.transaction(async (tx) => {
      await tx.update(account).set({ deleted: true }).where(eq(account.id, id));
      // Other accounts' transfer references pointing at this one convert
      // to the External placeholder, irreversibly, at deletion time.
      await this.transfers.convertAccountReferencesToExternal(tx, id);
    });
    await this.audit.record('account_deleted', memberId, req.ip ?? 'unknown');
  }
}
