import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportDistributionService } from './report-distribution.service';
import { ReportSeriesService } from './report-series.service';
import { ReportService } from './report.service';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('reports')
export class ReportController {
  constructor(
    private readonly reports: ReportService,
    private readonly reportSeries: ReportSeriesService,
    private readonly distributions: ReportDistributionService,
  ) {}

  @Get()
  list(@CurrentMember() memberId: MemberId) {
    return this.reports.list(memberId);
  }

  @Get(':id/series')
  series(@CurrentMember() memberId: MemberId, @Param('id', ParseUuidV7Pipe) id: string) {
    return this.reportSeries.getSeries(memberId, id);
  }

  @Get(':id/distribution')
  distribution(@CurrentMember() memberId: MemberId, @Param('id', ParseUuidV7Pipe) id: string) {
    return this.distributions.getDistribution(memberId, id);
  }

  @Post()
  @HttpCode(200)
  async create(
    @CurrentMember() memberId: MemberId,
    @Body() dto: CreateReportDto,
  ): Promise<{
    message: string;
    report: Awaited<ReturnType<ReportService['create']>>;
  }> {
    const created = await this.reports.create(memberId, dto);
    return { message: 'Report saved', report: created };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentMember() memberId: MemberId,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateReportDto,
  ): Promise<{ message: string }> {
    await this.reports.update(memberId, id, dto);
    return { message: 'Report saved' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @CurrentMember() memberId: MemberId,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<{ message: string }> {
    await this.reports.remove(memberId, id);
    return { message: 'Report deleted' };
  }
}
