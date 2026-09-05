import {
  BadRequestException,
  Inject,
  Injectable,
  UnprocessableEntityException,
} from '@nestjs/common';
import { and, asc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { AxisBounds } from '../common/chart-axis';
import { MinorUnits, toMajorUnits, toMinorUnits } from '../common/money';
import { computeSynthesisChart } from '../common/synthesis-chart';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, operation } from '../db/schema';
import { TransferService } from '../operations/transfer.service';
import { AuditService } from '../security/audit.service';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

export interface AccountChartPoint {
  period: string;
  value: number;
}

export interface AccountChart {
  currency: string;
  axisBounds: AxisBounds | null;
  points: AccountChartPoint[];
}

// Payment method id 9, "Initial balance", reserved for the
// system-generated opening operation.
const INITIAL_BALANCE_PAYMENT_METHOD_ID = 9;

@Injectable()
export class AccountService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly transfers: TransferService,
    private readonly audit: AuditService,
    private readonly ownership: OwnershipService,
  ) {}

  async list(req: Request, bankId?: number) {
    const memberId = requireMemberId(req);
    const conditions = [
      eq(bank.memberId, memberId),
      eq(bank.deleted, false),
      eq(account.deleted, false),
    ];
    if (bankId) {
      conditions.push(eq(account.bankId, bankId));
    }
    const rows = await this.db
      .select({ account })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(and(...conditions))
      .orderBy(asc(account.name));
    return rows.map((r) => r.account);
  }

  async create(req: Request, dto: CreateAccountDto) {
    const memberId = requireMemberId(req);
    const bankRow = await this.ownership.requireOwnedBank(dto.bankId, memberId);
    if (bankRow.closed || bankRow.deleted) {
      throw new UnprocessableEntityException('Bank is not active.');
    }

    const [created] = await this.db
      .insert(account)
      .values({
        bankId: dto.bankId,
        name: dto.name,
        currency: dto.currency,
      })
      .returning();

    const minorUnits = toMinorUnits(dto.initialBalance ?? 0);
    if (minorUnits !== 0) {
      await this.db.insert(operation).values({
        accountId: created.id,
        paymentMethodId: INITIAL_BALANCE_PAYMENT_METHOD_ID,
        thirdParty: 'Initial balance',
        credit: minorUnits > 0 ? minorUnits : null,
        debit: minorUnits < 0 ? (-(minorUnits as number) as MinorUnits) : null,
        reconciled: true,
      });
    }

    return created;
  }

  // Cumulative end-of-month balance for the last 12 months — the same
  // synthesis chart shown on the dashboard, scoped to this one account (and
  // therefore its one currency). Empty (no operations at all, ever) is
  // signalled by an empty `points` array; the chart component hides
  // itself in that case.
  async chart(req: Request, id: number): Promise<AccountChart> {
    const memberId = requireMemberId(req);
    const { account: acc } = await this.ownership.requireOwnedAccount(
      id,
      memberId,
    );

    const rows = await this.db
      .select({
        debit: operation.debit,
        credit: operation.credit,
        valueDate: operation.valueDate,
      })
      .from(operation)
      .where(eq(operation.accountId, id));

    if (rows.length === 0) {
      return { currency: acc.currency, axisBounds: null, points: [] };
    }

    const synthesis = computeSynthesisChart(
      rows.map((row) => ({ ...row, currency: acc.currency })),
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
  async balance(
    req: Request,
    id: number,
  ): Promise<{ balance: number; reconciledBalance: number }> {
    const memberId = requireMemberId(req);
    await this.ownership.requireOwnedAccount(id, memberId);

    const [row] = await this.db
      .select({
        credit: sql<string>`coalesce(sum(${operation.credit}), 0)`,
        debit: sql<string>`coalesce(sum(${operation.debit}), 0)`,
        reconciledCredit: sql<string>`coalesce(sum(${operation.credit}) filter (where ${operation.reconciled}), 0)`,
        reconciledDebit: sql<string>`coalesce(sum(${operation.debit}) filter (where ${operation.reconciled}), 0)`,
      })
      .from(operation)
      .where(eq(operation.accountId, id));

    return {
      // Both operands are already MinorUnits at the SQL level; `Number(...)`
      // is only unwrapping the string node-postgres hands back for a
      // NUMERIC/bigint aggregate — the subtraction itself always widens to
      // plain `number`, hence the cast on the finished total.
      balance: toMajorUnits(
        (Number(row.credit) - Number(row.debit)) as MinorUnits,
      ),
      reconciledBalance: toMajorUnits(
        (Number(row.reconciledCredit) -
          Number(row.reconciledDebit)) as MinorUnits,
      ),
    };
  }

  async update(req: Request, id: number, dto: UpdateAccountDto): Promise<void> {
    const memberId = requireMemberId(req);
    const { account: row } = await this.ownership.requireOwnedAccount(
      id,
      memberId,
    );
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Account is not active.');
    }
    if (dto.bankId !== row.bankId || dto.currency !== row.currency) {
      throw new BadRequestException('Bank and currency cannot be changed.');
    }
    await this.db
      .update(account)
      .set({ name: dto.name })
      .where(eq(account.id, id));
  }

  async close(req: Request, id: number): Promise<void> {
    const memberId = requireMemberId(req);
    const { account: row } = await this.ownership.requireOwnedAccount(
      id,
      memberId,
    );
    if (row.closed || row.deleted) {
      throw new UnprocessableEntityException('Account is not active.');
    }
    await this.db
      .update(account)
      .set({ closed: true })
      .where(eq(account.id, id));
    await this.audit.record('account_closed', memberId, req.ip ?? 'unknown');
  }

  async remove(req: Request, id: number): Promise<void> {
    const memberId = requireMemberId(req);
    const { account: row } = await this.ownership.requireOwnedAccount(
      id,
      memberId,
    );
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
