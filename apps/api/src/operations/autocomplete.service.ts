import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { ilikeContains } from '../common/like-pattern';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, category, operation } from '../db/schema';
import { requireMemberId } from '../session/require-member-id';
import { AutocompleteThirdPartyDto } from './dto/autocomplete-third-party.dto';
import { reachableAccountsOf } from '../security/reachable';

const MAX_SUGGESTIONS = 20;

export interface ThirdPartySuggestion {
  thirdParty: string;
  categoryId: string | null;
}

@Injectable()
export class OperationAutocompleteService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  // Distinct third parties matching the given text (2+ chars), scoped to
  // the member's own operations across non-deleted banks/accounts (closed
  // ones included). Each returned category is the one used on the latest
  // (by value date, then id) operation bearing that name; a category whose
  // type doesn't match the requested type is dropped, the third party stays.
  // At most MAX_SUGGESTIONS, exact then prefix matches first: the form
  // prefills the category from an exact match, so the cut must never drop
  // it.
  async search(req: Request, dto: AutocompleteThirdPartyDto): Promise<ThirdPartySuggestion[]> {
    const memberId = requireMemberId(req);
    const lowerThirdParty = sql<string>`lower(${operation.thirdParty})`;

    const matches = this.db
      .selectDistinctOn([lowerThirdParty], {
        thirdParty: operation.thirdParty,
        categoryId: operation.categoryId,
        categoryType: category.type,
      })
      .from(operation)
      .innerJoin(account, eq(operation.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .leftJoin(category, eq(operation.categoryId, category.id))
      .where(and(reachableAccountsOf(memberId), ilikeContains(operation.thirdParty, dto.q)))
      .orderBy(lowerThirdParty, desc(operation.valueDate), desc(operation.id))
      .as('matches');

    const rows = await this.db
      .select()
      .from(matches)
      .orderBy(
        sql`lower(${matches.thirdParty}) = lower(${dto.q}) desc`,
        sql`starts_with(lower(${matches.thirdParty}), lower(${dto.q})) desc`,
        sql`lower(${matches.thirdParty})`,
      )
      .limit(MAX_SUGGESTIONS);

    return rows.map((row) => ({
      thirdParty: row.thirdParty,
      categoryId:
        dto.type && row.categoryType && row.categoryType !== dto.type ? null : row.categoryId,
    }));
  }
}
