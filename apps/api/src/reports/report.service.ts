import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, category, report, reportAccount, reportCategory } from '../db/schema';
import { ReportId } from '../security/ids';
import { OwnershipService } from '../security/ownership.service';
import { requireMemberId } from '../session/require-member-id';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly ownership: OwnershipService,
  ) {}

  // Keeps only the ids among the submitted set that belong to the member's
  // non-deleted accounts in non-deleted banks — foreign, unknown, closed
  // (allowed), and since-deleted ids are dropped silently.
  private async filterOwnedActiveAccountIds(
    accountIds: string[],
    memberId: string,
  ): Promise<string[]> {
    if (accountIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({ id: account.id })
      .from(account)
      .innerJoin(bank, eq(account.bankId, bank.id))
      .where(
        and(
          inArray(account.id, accountIds),
          eq(bank.memberId, memberId),
          eq(account.deleted, false),
          eq(bank.deleted, false),
        ),
      );
    return rows.map((row) => row.id);
  }

  private async accountIdsByReport(reportIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (reportIds.length === 0) {
      return map;
    }
    const links = await this.db
      .select({
        reportId: reportAccount.reportId,
        accountId: reportAccount.accountId,
      })
      .from(reportAccount)
      .where(inArray(reportAccount.reportId, reportIds));
    for (const link of links) {
      const list = map.get(link.reportId) ?? [];
      list.push(link.accountId);
      map.set(link.reportId, list);
    }
    return map;
  }

  // Categories are fixed reference data, not member-owned — unlike
  // filterOwnedActiveAccountIds, this only needs to check the ids are real,
  // not that they belong to the member.
  private async filterExistingCategoryIds(categoryIds: string[]): Promise<string[]> {
    if (categoryIds.length === 0) {
      return [];
    }
    const rows = await this.db
      .select({ id: category.id })
      .from(category)
      .where(inArray(category.id, categoryIds));
    return rows.map((row) => row.id);
  }

  private async categoryIdsByReport(reportIds: string[]): Promise<Map<string, string[]>> {
    const map = new Map<string, string[]>();
    if (reportIds.length === 0) {
      return map;
    }
    const links = await this.db
      .select({
        reportId: reportCategory.reportId,
        categoryId: reportCategory.categoryId,
      })
      .from(reportCategory)
      .where(inArray(reportCategory.reportId, reportIds));
    for (const link of links) {
      const list = map.get(link.reportId) ?? [];
      list.push(link.categoryId);
      map.set(link.reportId, list);
    }
    return map;
  }

  async list(req: Request) {
    const memberId = requireMemberId(req);
    const rows = await this.db
      .select()
      .from(report)
      .where(eq(report.memberId, memberId))
      // Ordered by type name, then title — the enum's declaration order
      // (sum, average) doesn't match, so sort on its text form instead.
      .orderBy(sql`${report.type}::text`, asc(report.title));

    const accountIds = await this.accountIdsByReport(rows.map((row) => row.id));
    const categoryIds = await this.categoryIdsByReport(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...row,
      accountIds: accountIds.get(row.id) ?? [],
      categoryIds: categoryIds.get(row.id) ?? [],
    }));
  }

  async create(req: Request, dto: CreateReportDto) {
    const memberId = requireMemberId(req);
    const accountIds = await this.filterOwnedActiveAccountIds(dto.accountIds ?? [], memberId);
    const categoryIds = await this.filterExistingCategoryIds(dto.categoryIds ?? []);

    const created = await this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(report)
        .values({
          memberId,
          type: dto.type,
          title: dto.title,
          homepage: dto.homepage ?? false,
          valueDateStart: dto.valueDateStart,
          valueDateEnd: dto.valueDateEnd,
          thirdParties: dto.thirdParties,
          reconciledOnly: dto.reconciledOnly,
          periodGrouping: dto.periodGrouping,
          dataGrouping: dto.dataGrouping,
          significantResultsNumber: dto.significantResultsNumber,
        })
        .returning();
      if (accountIds.length > 0) {
        await tx
          .insert(reportAccount)
          .values(accountIds.map((accountId) => ({ reportId: row.id, accountId })));
      }
      if (categoryIds.length > 0) {
        await tx
          .insert(reportCategory)
          .values(categoryIds.map((categoryId) => ({ reportId: row.id, categoryId })));
      }
      return row;
    });

    return { ...created, accountIds, categoryIds };
  }

  async update(req: Request, id: string, dto: UpdateReportDto): Promise<void> {
    const memberId = requireMemberId(req);
    await this.ownership.requireOwnedReport(id as ReportId, memberId);
    const accountIds = await this.filterOwnedActiveAccountIds(dto.accountIds ?? [], memberId);
    const categoryIds = await this.filterExistingCategoryIds(dto.categoryIds ?? []);

    await this.db.transaction(async (tx) => {
      await tx
        .update(report)
        .set({
          type: dto.type,
          title: dto.title,
          homepage: dto.homepage ?? false,
          valueDateStart: dto.valueDateStart ?? null,
          valueDateEnd: dto.valueDateEnd ?? null,
          thirdParties: dto.thirdParties ?? null,
          reconciledOnly: dto.reconciledOnly ?? null,
          periodGrouping: dto.periodGrouping,
          // Nulled out via `?? null` (not left as `undefined`, which Drizzle
          // would treat as "don't touch this column") when editing a report
          // away from 'distribution' — its now-meaningless dataGrouping/
          // significantResultsNumber must be cleared, not left stale.
          dataGrouping: dto.dataGrouping ?? null,
          significantResultsNumber: dto.significantResultsNumber ?? null,
        })
        .where(eq(report.id, id));

      // Account/category selection is replaced wholesale on every save;
      // links to since-deleted accounts (or stale category ids) are purged
      // as part of the replacement.
      await tx.delete(reportAccount).where(eq(reportAccount.reportId, id));
      if (accountIds.length > 0) {
        await tx
          .insert(reportAccount)
          .values(accountIds.map((accountId) => ({ reportId: id, accountId })));
      }
      await tx.delete(reportCategory).where(eq(reportCategory.reportId, id));
      if (categoryIds.length > 0) {
        await tx
          .insert(reportCategory)
          .values(categoryIds.map((categoryId) => ({ reportId: id, categoryId })));
      }
    });
  }

  async remove(req: Request, id: string): Promise<void> {
    const memberId = requireMemberId(req);
    await this.ownership.requireOwnedReport(id as ReportId, memberId);

    await this.db.transaction(async (tx) => {
      await tx.delete(reportAccount).where(eq(reportAccount.reportId, id));
      await tx.delete(reportCategory).where(eq(reportCategory.reportId, id));
      await tx.delete(report).where(eq(report.id, id));
    });
  }
}
