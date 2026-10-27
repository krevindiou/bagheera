import { Inject, Injectable } from '@nestjs/common';
import { and, eq, inArray, isNotNull, lt, lte, ne, or, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { thirdPartyKeyOf } from '../../common/third-party-key';
import { DRIZZLE } from '../../db/db.constants';
import {
  account,
  accountStatement,
  bank,
  category,
  labelCorrection,
  operation,
  paymentMethod,
} from '../../db/schema';
import { MemberId } from '../../security/ids';
import { reachableAccountsOf } from '../../security/reachable';
import { OPENING_BALANCE_PAYMENT_METHOD_ID } from '../entry-rules';
import type { StatementSummaryDto } from './import.dto';
import { labelKey, normalizeLabel } from './rows/labels';
import { recordedWindows } from './rows/recorded-match';
import type { CategoryUse, MethodUse, TransferUse } from './rows/suggestions';
import type { ReadyRow, RowOutcome } from './rows/types';

// A SQL array of dates; a JS array would be spread into a list of parameters.
// Operations are looked up by third party with the database's twin of
// normalizeLabel, which operation_account_id_third_party_key_idx serves.
function thirdPartyKey() {
  return thirdPartyKeyOf(operation.thirdParty);
}

function thirdPartyKeys(rows: RowOutcome[]): string[] {
  return [
    ...new Set(
      rows.flatMap((row) => (row.status === 'invalid' ? [] : [normalizeLabel(row.thirdParty)])),
    ),
  ];
}

function dateArray(dates: string[]) {
  return sql`array[${sql.join(
    dates.map((date) => sql`${date}::date`),
    sql`, `,
  )}]`;
}

/**
 * What an import reads from the database besides the file: the balances of the
 * account, the operations rows may match, and the Member's earlier operations
 * and remembered corrections behind the suggestions.
 */
@Injectable()
export class ImportHistory {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  // The label corrections the Member remembered, by label of the file.
  async corrections(memberId: MemberId): Promise<Map<string, string>> {
    const remembered = await this.db
      .select({ sourceLabel: labelCorrection.sourceLabel, thirdParty: labelCorrection.thirdParty })
      .from(labelCorrection)
      .where(eq(labelCorrection.memberId, memberId));
    return new Map(remembered.map((row) => [labelKey(row.sourceLabel), row.thirdParty]));
  }

  // The type of each payment method among the ids that exist.
  async paymentMethodTypes(ids: string[]): Promise<Map<string, string | null>> {
    const found = await this.db
      .select({ id: paymentMethod.id, type: paymentMethod.type })
      .from(paymentMethod)
      .where(inArray(paymentMethod.id, ids));
    return new Map(found.map((row) => [row.id, row.type]));
  }

  // The type of each category among the ids that exist.
  async categoryTypes(ids: string[]): Promise<Map<string, string | null>> {
    const found = await this.db
      .select({ id: category.id, type: category.type })
      .from(category)
      .where(inArray(category.id, ids));
    return new Map(found.map((row) => [row.id, row.type]));
  }

  async hasOperationBefore(accountId: string, date: string): Promise<boolean> {
    const [row] = await this.db
      .select({ one: sql`1` })
      .from(operation)
      .where(and(eq(operation.accountId, accountId), lt(operation.valueDate, date)))
      .limit(1);
    return row !== undefined;
  }

  // The balance of the account on a date, in minor units.
  async balanceUpTo(accountId: string, date: string): Promise<number> {
    const [row] = await this.db
      .select({
        balance: sql<string>`coalesce(sum(${operation.credit}), 0) - coalesce(sum(${operation.debit}), 0)`,
      })
      .from(operation)
      .where(and(eq(operation.accountId, accountId), lte(operation.valueDate, date)));
    return Number(row.balance);
  }

  async accountCheck(
    memberId: MemberId,
    target: { id: string },
    fingerprints: string[] | null,
  ): Promise<Pick<StatementSummaryDto, 'accountCheck' | 'otherAccountId'>> {
    if (fingerprints === null) return { accountCheck: 'unknown', otherAccountId: null };
    const [remembered] = await this.db
      .select({ fingerprint: accountStatement.fingerprint })
      .from(accountStatement)
      .where(eq(accountStatement.accountId, target.id));
    if (remembered && fingerprints.includes(remembered.fingerprint)) {
      return { accountCheck: 'same', otherAccountId: null };
    }
    const [other] = await this.db
      .select({ id: account.id })
      .from(accountStatement)
      .innerJoin(account, eq(account.id, accountStatement.accountId))
      .where(
        and(
          reachableAccountsOf(this.db, memberId),
          inArray(accountStatement.fingerprint, fingerprints),
          ne(account.id, target.id),
        ),
      )
      .limit(1);
    if (other) return { accountCheck: 'elsewhere', otherAccountId: other.id };
    return { accountCheck: remembered ? 'different' : 'unknown', otherAccountId: null };
  }

  // How often the Member gave each payment method to operations of the third
  // parties the rows carry, in every account they can reach. Every row's third
  // party is looked up, picked methods or not, so that the result, and the
  // revision built from it, do not depend on the picks.
  async methodUsage(memberId: MemberId, rows: RowOutcome[]): Promise<MethodUse[]> {
    const keys = thirdPartyKeys(rows);
    if (keys.length === 0) return [];
    const thirdParty = thirdPartyKey();
    const isDebit = sql<boolean>`${operation.debit} is not null`;
    const found = await this.db
      .select({
        thirdParty,
        isDebit,
        paymentMethodId: operation.paymentMethodId,
        uses: sql<number>`count(*)::int`,
        lastDate: sql<string>`max(${operation.valueDate})`,
      })
      .from(operation)
      .innerJoin(account, eq(account.id, operation.accountId))
      .where(
        and(
          reachableAccountsOf(this.db, memberId),
          ne(operation.paymentMethodId, OPENING_BALANCE_PAYMENT_METHOD_ID),
          inArray(thirdParty, keys),
        ),
      )
      .groupBy(thirdParty, isDebit, operation.paymentMethodId);
    return found.map((row) => ({
      type: row.isDebit ? 'debit' : 'credit',
      thirdParty: row.thirdParty,
      paymentMethodId: row.paymentMethodId,
      uses: row.uses,
      lastDate: row.lastDate,
    }));
  }

  // How often each account was the other side of the transfers of the third
  // parties the rows carry, in the account imported into, leaving out the
  // accounts a transfer could not go to now. Like the method usage, it does not
  // depend on the picks.
  async transferUsage(
    memberId: MemberId,
    importedInto: { id: string; currency: string },
    rows: RowOutcome[],
  ): Promise<TransferUse[]> {
    const keys = thirdPartyKeys(rows);
    if (keys.length === 0) return [];
    const thirdParty = thirdPartyKey();
    const isDebit = sql<boolean>`${operation.debit} is not null`;
    const found = await this.db
      .select({
        thirdParty,
        isDebit,
        accountId: operation.transferAccountId,
        uses: sql<number>`count(*)::int`,
        lastDate: sql<string>`max(${operation.valueDate})`,
      })
      .from(operation)
      .where(
        and(
          eq(operation.accountId, importedInto.id),
          isNotNull(operation.transferAccountId),
          inArray(thirdParty, keys),
        ),
      )
      .groupBy(thirdParty, isDebit, operation.transferAccountId);
    if (found.length === 0) return [];

    const candidates = await this.db
      .select({ id: account.id, closed: account.closed, bankClosed: bank.closed })
      .from(account)
      .innerJoin(bank, eq(bank.id, account.bankId))
      .where(
        and(
          reachableAccountsOf(this.db, memberId),
          inArray(account.id, [...new Set(found.map((row) => row.accountId as string))]),
          eq(account.currency, importedInto.currency),
          ne(account.id, importedInto.id),
        ),
      );
    const usable = new Set(
      candidates.filter((row) => !row.closed && !row.bankClosed).map((row) => row.id),
    );
    return found
      .filter((row) => usable.has(row.accountId as string))
      .map((row) => ({
        type: row.isDebit ? 'debit' : 'credit',
        thirdParty: row.thirdParty,
        accountId: row.accountId as string,
        uses: row.uses,
        lastDate: row.lastDate,
      }));
  }

  // How often the Member gave each category to operations of the third
  // parties the rows carry, in every account they can reach.
  async categoryUsage(memberId: MemberId, rows: RowOutcome[]): Promise<CategoryUse[]> {
    const keys = thirdPartyKeys(rows);
    if (keys.length === 0) return [];
    const thirdParty = thirdPartyKey();
    const found = await this.db
      .select({
        thirdParty,
        isDebit: sql<boolean>`${operation.debit} is not null`,
        categoryId: operation.categoryId,
        uses: sql<number>`count(*)::int`,
        lastDate: sql<string>`max(${operation.valueDate})`,
      })
      .from(operation)
      .innerJoin(account, eq(account.id, operation.accountId))
      .where(
        and(
          reachableAccountsOf(this.db, memberId),
          isNotNull(operation.categoryId),
          inArray(thirdParty, keys),
        ),
      )
      .groupBy(thirdParty, sql`${operation.debit} is not null`, operation.categoryId);
    return found.map((row) => ({
      type: row.isDebit ? 'debit' : 'credit',
      thirdParty: row.thirdParty,
      categoryId: row.categoryId as string,
      uses: row.uses,
      lastDate: row.lastDate,
    }));
  }

  // The account's operations a row can match: those within a few days of a date
  // of the rows (not the days between them: a file spanning years must not
  // load the whole account), and those that kept a bank reference the file
  // holds, whatever their date is now.
  // `executor` lets the check made while the account is held read inside that
  // transaction.
  async recordedAround(
    accountId: string,
    rows: RowOutcome[],
    executor: Pick<NodePgDatabase, 'select'> = this.db,
  ) {
    const ready = rows.filter((row): row is ReadyRow => row.status !== 'invalid');
    if (ready.length === 0) return [];
    const windows = recordedWindows(ready.map((row) => row.valueDate));
    const references = [
      ...new Set(ready.flatMap((row) => (row.bankReference === null ? [] : [row.bankReference]))),
    ];
    return (
      executor
        .select({
          valueDate: operation.valueDate,
          debit: operation.debit,
          credit: operation.credit,
          thirdParty: operation.thirdParty,
          sourceLabel: operation.sourceLabel,
          bankReference: operation.bankReference,
          id: operation.id,
          reconciled: operation.reconciled,
          paymentMethodId: operation.paymentMethodId,
        })
        .from(operation)
        .where(
          and(
            eq(operation.accountId, accountId),
            or(
              sql`exists (
              select 1
              from unnest(${dateArray(windows.map((w) => w.from))}, ${dateArray(windows.map((w) => w.to))})
                as window_(window_from, window_to)
              where ${operation.valueDate} between window_.window_from and window_.window_to)`,
              references.length > 0 ? inArray(operation.bankReference, references) : undefined,
            ),
          ),
        )
        // Among equal operations the first one in this order is the one a row
        // takes: two reads of the same account must pick the same.
        .orderBy(operation.id)
    );
  }
}
