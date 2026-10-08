import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { category, member, report, reportAccount, reportCategory } from '../db/schema';
import { MemberId, ReportId } from '../security/ids';
import { requireBelowQuota } from '../security/member-quotas';
import { OwnershipService } from '../security/ownership.service';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly ownership: OwnershipService,
  ) {}

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

  // Categories aren't member-owned: only check they exist.
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

  async list(memberId: MemberId) {
    const rows = await this.db
      .select()
      .from(report)
      .where(eq(report.memberId, memberId))
      // By type name (not enum declaration order), then title.
      .orderBy(sql`${report.type}::text`, asc(report.title));

    const accountIds = await this.accountIdsByReport(rows.map((row) => row.id));
    const categoryIds = await this.categoryIdsByReport(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...row,
      accountIds: accountIds.get(row.id) ?? [],
      categoryIds: categoryIds.get(row.id) ?? [],
    }));
  }

  async create(memberId: MemberId, dto: CreateReportDto) {
    const accountIds = await this.ownership.filterOwnedAccountIds(dto.accountIds ?? [], memberId);
    const categoryIds = await this.filterExistingCategoryIds(dto.categoryIds ?? []);

    const created = await this.db.transaction(async (tx) => {
      // Serializes concurrent creates for the quota check below.
      const [memberRow] = await tx
        .select()
        .from(member)
        .where(eq(member.id, memberId))
        .for('update');

      if (!memberRow) {
        throw new Error('Member not found');
      }

      const held = await this.ownership.countOwned('reports', memberId);
      requireBelowQuota('reports', held);

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

  async update(memberId: MemberId, id: string, dto: UpdateReportDto): Promise<void> {
    await this.ownership.requireOwnedReport(id as ReportId, memberId);
    const accountIds = await this.ownership.filterOwnedAccountIds(dto.accountIds ?? [], memberId);
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
          // `?? null`, not undefined (= untouched): leaving 'distribution'
          // must clear these.
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

  async remove(memberId: MemberId, id: string): Promise<void> {
    await this.ownership.requireOwnedReport(id as ReportId, memberId);

    await this.db.transaction(async (tx) => {
      await tx.delete(reportAccount).where(eq(reportAccount.reportId, id));
      await tx.delete(reportCategory).where(eq(reportCategory.reportId, id));
      await tx.delete(report).where(eq(report.id, id));
    });
  }
}
