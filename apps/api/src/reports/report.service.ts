import {
  Injectable,
  Inject,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { account, bank, report, reportAccount } from '../db/schema';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';

@Injectable()
export class ReportService {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  private requireMemberId(req: Request): number {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }
    return memberId;
  }

  private async findOwnedReport(id: number, memberId: number) {
    const [row] = await this.db.select().from(report).where(eq(report.id, id));
    if (!row || row.memberId !== memberId) {
      throw new NotFoundException();
    }
    return row;
  }

  // Keeps only the ids among the submitted set that belong to the member's
  // non-deleted accounts in non-deleted banks — foreign, unknown, closed
  // (allowed), and since-deleted ids are dropped silently.
  private async filterOwnedActiveAccountIds(
    accountIds: number[],
    memberId: number,
  ): Promise<number[]> {
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

  private async accountIdsByReport(
    reportIds: number[],
  ): Promise<Map<number, number[]>> {
    const map = new Map<number, number[]>();
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

  async list(req: Request) {
    const memberId = this.requireMemberId(req);
    const rows = await this.db
      .select()
      .from(report)
      .where(eq(report.memberId, memberId))
      // Ordered by type name, then title — the enum's declaration order
      // (sum, average) doesn't match, so sort on its text form instead.
      .orderBy(sql`${report.type}::text`, asc(report.title));

    const accountIds = await this.accountIdsByReport(rows.map((row) => row.id));
    return rows.map((row) => ({
      ...row,
      accountIds: accountIds.get(row.id) ?? [],
    }));
  }

  async create(req: Request, dto: CreateReportDto) {
    const memberId = this.requireMemberId(req);
    const accountIds = await this.filterOwnedActiveAccountIds(
      dto.accountIds ?? [],
      memberId,
    );

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
        })
        .returning();
      if (accountIds.length > 0) {
        await tx
          .insert(reportAccount)
          .values(
            accountIds.map((accountId) => ({ reportId: row.id, accountId })),
          );
      }
      return row;
    });

    return { ...created, accountIds };
  }

  async update(req: Request, id: number, dto: UpdateReportDto): Promise<void> {
    const memberId = this.requireMemberId(req);
    await this.findOwnedReport(id, memberId);
    const accountIds = await this.filterOwnedActiveAccountIds(
      dto.accountIds ?? [],
      memberId,
    );

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
        })
        .where(eq(report.id, id));

      // Account selection is replaced wholesale on every save; links to
      // since-deleted accounts are purged as part of the replacement.
      await tx.delete(reportAccount).where(eq(reportAccount.reportId, id));
      if (accountIds.length > 0) {
        await tx
          .insert(reportAccount)
          .values(accountIds.map((accountId) => ({ reportId: id, accountId })));
      }
    });
  }

  async remove(req: Request, id: number): Promise<void> {
    const memberId = this.requireMemberId(req);
    await this.findOwnedReport(id, memberId);

    await this.db.transaction(async (tx) => {
      await tx.delete(reportAccount).where(eq(reportAccount.reportId, id));
      await tx.delete(report).where(eq(report.id, id));
    });
  }
}
