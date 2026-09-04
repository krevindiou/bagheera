import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, gte, inArray, isNotNull, lte, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import type { RedisClientType } from 'redis';
import { ilikeContains } from '../common/like-pattern';
import { toMinorUnits } from '../common/money';
import { DRIZZLE } from '../db/db.constants';
import { operation } from '../db/schema';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';
import {
  SESSION_IDLE_TTL_SECONDS,
  VALKEY_CLIENT,
} from '../session/session.constants';
import { SearchOperationsDto } from './dto/search-operations.dto';

const PAGE_SIZE = 20;

// The subset of SearchOperationsDto that gets remembered across requests —
// accountId is the Valkey key's scope, not part of the stored payload.
type SearchCriteria = Omit<SearchOperationsDto, 'accountId'>;

const AMOUNT_OPERATORS = {
  gt: sql`>`,
  gte: sql`>=`,
  lt: sql`<`,
  lte: sql`<=`,
  eq: sql`=`,
} as const;

@Injectable()
export class OperationSearchService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    @Inject(VALKEY_CLIENT) private readonly valkey: RedisClientType,
    private readonly ownership: OwnershipService,
  ) {}

  private key(memberId: number, accountId: number): string {
    return `opsearch:${memberId}:${accountId}`;
  }

  private async remember(
    memberId: number,
    accountId: number,
    criteria: SearchCriteria,
  ): Promise<void> {
    await this.valkey.set(
      this.key(memberId, accountId),
      JSON.stringify(criteria),
      { EX: SESSION_IDLE_TTL_SECONDS },
    );
  }

  private async recall(
    memberId: number,
    accountId: number,
  ): Promise<SearchCriteria> {
    const raw = await this.valkey.get(this.key(memberId, accountId));
    return raw ? (JSON.parse(raw) as SearchCriteria) : {};
  }

  async clear(req: Request, accountId: number): Promise<void> {
    const memberId = requireMemberId(req);
    await this.ownership.requireOwnedAccount(accountId, memberId);
    await this.valkey.del(this.key(memberId, accountId));
  }

  // Runs a fresh search and remembers the criteria for this member+account.
  async search(req: Request, dto: SearchOperationsDto, page: number) {
    const memberId = requireMemberId(req);
    await this.ownership.requireOwnedAccount(dto.accountId, memberId);

    const { accountId, ...criteria } = dto;
    await this.remember(memberId, accountId, criteria);
    return this.run(accountId, criteria, page);
  }

  // Re-runs the last remembered search (empty criteria if none stored yet).
  // Exposes the criteria and whether any is set, so the frontend can
  // restore the search panel's open/hydrated state on mount.
  async recallAndRun(req: Request, accountId: number, page: number) {
    const memberId = requireMemberId(req);
    await this.ownership.requireOwnedAccount(accountId, memberId);

    const criteria = await this.recall(memberId, accountId);
    const result = await this.run(accountId, criteria, page);
    return {
      ...result,
      criteria,
      active: Object.keys(criteria).length > 0,
    };
  }

  private async run(accountId: number, criteria: SearchCriteria, page: number) {
    const conditions = [eq(operation.accountId, accountId)];

    if (criteria.type) {
      conditions.push(
        criteria.type === 'debit'
          ? isNotNull(operation.debit)
          : isNotNull(operation.credit),
      );
    }
    if (criteria.thirdParty) {
      conditions.push(ilikeContains(operation.thirdParty, criteria.thirdParty));
    }
    if (criteria.categoryIds?.length) {
      conditions.push(inArray(operation.categoryId, criteria.categoryIds));
    }
    if (criteria.paymentMethodIds?.length) {
      conditions.push(
        inArray(operation.paymentMethodId, criteria.paymentMethodIds),
      );
    }
    for (const comparator of criteria.amountComparators ?? []) {
      const op = AMOUNT_OPERATORS[comparator.operator];
      conditions.push(
        sql`coalesce(${operation.debit}, ${operation.credit}) ${op} ${toMinorUnits(comparator.value)}`,
      );
    }
    if (criteria.dateFrom) {
      conditions.push(gte(operation.valueDate, criteria.dateFrom));
    }
    if (criteria.dateTo) {
      conditions.push(lte(operation.valueDate, criteria.dateTo));
    }
    if (criteria.notes) {
      conditions.push(ilikeContains(operation.notes, criteria.notes));
    }
    if (criteria.reconciled !== undefined) {
      conditions.push(eq(operation.reconciled, criteria.reconciled));
    }

    const where = and(...conditions);
    const pageNumber = page > 0 ? page : 1;

    const rows = await this.db
      .select()
      .from(operation)
      .where(where)
      .orderBy(
        desc(operation.valueDate),
        desc(operation.createdAt),
        desc(operation.id),
      )
      .limit(PAGE_SIZE)
      .offset((pageNumber - 1) * PAGE_SIZE);

    const [{ total }] = await this.db
      .select({ total: sql<number>`count(*)::int` })
      .from(operation)
      .where(where);

    return { items: rows, total, page: pageNumber, pageSize: PAGE_SIZE };
  }
}
