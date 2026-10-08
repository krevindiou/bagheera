import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { balancesByAccount, ZERO_BALANCE } from '../common/balances';
import { BusinessError } from '../common/filters/business-error';
import { MinorUnits, toMinorUnits } from '../common/money';
import { monthlyNetByAccount, toSynthesisChartRow } from '../common/monthly-net';
import {
  computeSynthesisChart,
  latestValueDate,
  parseSynthesisChartWindow,
} from '../common/synthesis-chart';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, member, operation } from '../db/schema';
import { OPENING_BALANCE_PAYMENT_METHOD_ID } from '../operations/entry-rules';
import { TransferService } from '../operations/transfer.service';
import { AuditService } from '../security/audit.service';
import { MemberId, AccountId, BankId } from '../security/ids';
import { requireBelowQuota } from '../security/member-quotas';
import { OwnershipService } from '../security/ownership.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { reachableAccountsOf } from '../security/reachable';
import { ChartPointDto } from '../common/dto/chart-response.dto';
import { AccountChartDto } from './dto/account-response.dto';

export type AccountChartPoint = ChartPointDto;

export type AccountChart = AccountChartDto;

@Injectable()
export class AccountService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly transfers: TransferService,
    private readonly audit: AuditService,
    private readonly ownership: OwnershipService,
  ) {}

  async list(memberId: MemberId, bankId?: string) {
    const conditions = [reachableAccountsOf(this.db, memberId)];
    if (bankId) {
      conditions.push(eq(account.bankId, bankId));
    }
    const rows = await this.db
      .select({ account })
      .from(account)
      .where(and(...conditions))
      .orderBy(asc(account.name));
    const accounts = rows.map((r) => r.account);

    // One bulk aggregate for the whole list rather than N `balance()` calls.
    const balances = await balancesByAccount(
      this.db,
      accounts.map((a) => a.id),
    );
    return accounts.map((a) => {
      const entry = balances.get(a.id) ?? ZERO_BALANCE;
      return {
        ...a,
        balance: entry.balance,
        reconciledBalance: entry.reconciledBalance,
      };
    });
  }

  async create(memberId: MemberId, dto: CreateAccountDto) {
    const bankRow = await this.ownership.requireOwnedBank(dto.bankId as BankId, memberId);
    if (bankRow.closed || bankRow.deleted) {
      throw new BusinessError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'bank_not_active',
        'Bank is not active.',
      );
    }

    const minorUnits = toMinorUnits(dto.initialBalance ?? 0);
    return this.db.transaction(async (tx) => {
      // The member lock serializes concurrent creates for the quota check
      // below; the bank lock pins its active status.
      const [memberRow] = await tx
        .select()
        .from(member)
        .where(eq(member.id, memberId))
        .for('update');

      if (!memberRow) {
        throw new Error('Member not found');
      }

      const [lockedBank] = await tx
        .select()
        .from(bank)
        .where(eq(bank.id, dto.bankId))
        .for('update');

      if (!lockedBank || lockedBank.closed || lockedBank.deleted) {
        throw new BusinessError(
          HttpStatus.UNPROCESSABLE_ENTITY,
          'bank_not_active',
          'Bank is not active.',
        );
      }

      const held = await this.ownership.countOwned('accounts', memberId);
      requireBelowQuota('accounts', held);

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
          paymentMethodId: OPENING_BALANCE_PAYMENT_METHOD_ID,
          thirdParty: 'Initial balance',
          credit: minorUnits > 0 ? minorUnits : null,
          debit: minorUnits < 0 ? (-(minorUnits as number) as MinorUnits) : null,
          reconciled: true,
        });
      }

      return created;
    });
  }

  // The dashboard's synthesis chart scoped to one account (so one
  // currency). The window ends at the account's latest operation, not
  // today. No operations at all → empty `points`.
  async chart(memberId: MemberId, id: string, range?: string): Promise<AccountChart> {
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
  async balance(
    memberId: MemberId,
    id: string,
  ): Promise<{ balance: number; reconciledBalance: number }> {
    await this.ownership.requireOwnedAccount(id as AccountId, memberId);

    const entry = (await balancesByAccount(this.db, [id])).get(id) ?? ZERO_BALANCE;
    return {
      balance: entry.balance,
      reconciledBalance: entry.reconciledBalance,
    };
  }

  async update(memberId: MemberId, id: string, dto: UpdateAccountDto): Promise<void> {
    const { account: row } = await this.ownership.requireOwnedFullyActiveAccount(
      id as AccountId,
      memberId,
    );
    if (dto.bankId !== row.bankId || dto.currency !== row.currency) {
      throw new BusinessError(
        HttpStatus.BAD_REQUEST,
        'bank_currency_immutable',
        'Bank and currency cannot be changed.',
      );
    }
    await this.db.update(account).set({ name: dto.name }).where(eq(account.id, id));
  }

  async close(memberId: MemberId, ip: string, id: string): Promise<void> {
    await this.ownership.requireOwnedFullyActiveAccount(id as AccountId, memberId);
    await this.db.update(account).set({ closed: true }).where(eq(account.id, id));
    await this.audit.record('account_closed', memberId, ip);
  }

  async remove(memberId: MemberId, ip: string, id: string): Promise<void> {
    const { account: row } = await this.ownership.requireOwnedAccount(id as AccountId, memberId);
    if (row.deleted) {
      throw new BusinessError(
        HttpStatus.UNPROCESSABLE_ENTITY,
        'account_already_deleted',
        'Account is already deleted.',
      );
    }
    await this.db.transaction(async (tx) => {
      await tx.update(account).set({ deleted: true }).where(eq(account.id, id));
      // Other accounts' transfer references pointing at this one convert
      // to the External placeholder, irreversibly, at deletion time.
      await this.transfers.convertAccountReferencesToExternal(tx, id);
    });
    await this.audit.record('account_deleted', memberId, ip);
  }
}
