import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { and, desc, eq, ilike, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { escapeLikePattern } from '../common/like-pattern';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, category, operation } from '../db/schema';
import '../session/session-data';
import { AutocompleteThirdPartyDto } from './dto/autocomplete-third-party.dto';

export interface ThirdPartySuggestion {
  thirdParty: string;
  categoryId: number | null;
}

@Injectable()
export class OperationAutocompleteService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  private requireMemberId(req: Request): number {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    return memberId;
  }

  // Distinct third parties matching the given text (2+ chars), scoped to
  // the member's own operations across non-deleted banks/accounts (closed
  // ones included). Each returned category is the one used on the latest
  // (by value date, then id) operation bearing that name; a category whose
  // type doesn't match the requested type is dropped, the third party stays.
  async search(
    req: Request,
    dto: AutocompleteThirdPartyDto,
  ): Promise<ThirdPartySuggestion[]> {
    const memberId = this.requireMemberId(req);
    const lowerThirdParty = sql<string>`lower(${operation.thirdParty})`;

    const rows = await this.db
      .selectDistinctOn([lowerThirdParty], {
        thirdParty: operation.thirdParty,
        categoryId: operation.categoryId,
        categoryType: category.type,
      })
      .from(operation)
      .innerJoin(account, eq(operation.accountId, account.id))
      .innerJoin(bank, eq(account.bankId, bank.id))
      .leftJoin(category, eq(operation.categoryId, category.id))
      .where(
        and(
          eq(bank.memberId, memberId),
          eq(bank.deleted, false),
          eq(account.deleted, false),
          ilike(operation.thirdParty, `%${escapeLikePattern(dto.q)}%`),
        ),
      )
      .orderBy(lowerThirdParty, desc(operation.valueDate), desc(operation.id));

    return rows.map((row) => ({
      thirdParty: row.thirdParty,
      categoryId:
        dto.type && row.categoryType && row.categoryType !== dto.type
          ? null
          : row.categoryId,
    }));
  }
}
