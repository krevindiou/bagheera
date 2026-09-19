import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { SkipRateLimit } from '../security/skip-rate-limit.decorator';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportDistributionService } from './report-distribution.service';
import { ReportSeriesService } from './report-series.service';
import { ReportService } from './report.service';

// Ordinary authenticated CRUD, scoped to the caller's own reports — no
// enumerable secret to brute-force. See SkipRateLimit's doc comment.
@SkipRateLimit()
@Controller('reports')
export class ReportController {
  constructor(
    private readonly reports: ReportService,
    private readonly reportSeries: ReportSeriesService,
    private readonly distributions: ReportDistributionService,
  ) {}

  @Get()
  list(@Req() req: Request) {
    return this.reports.list(req);
  }

  @Get(':id/series')
  series(@Req() req: Request, @Param('id', ParseUuidV7Pipe) id: string) {
    return this.reportSeries.getSeries(req, id);
  }

  @Get(':id/distribution')
  distribution(@Req() req: Request, @Param('id', ParseUuidV7Pipe) id: string) {
    return this.distributions.getDistribution(req, id);
  }

  @Post()
  @HttpCode(200)
  async create(
    @Req() req: Request,
    @Body() dto: CreateReportDto,
  ): Promise<{
    message: string;
    report: Awaited<ReturnType<ReportService['create']>>;
  }> {
    const created = await this.reports.create(req, dto);
    return { message: 'Report saved', report: created };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateReportDto,
  ): Promise<{ message: string }> {
    await this.reports.update(req, id, dto);
    return { message: 'Report saved' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<{ message: string }> {
    await this.reports.remove(req, id);
    return { message: 'Report deleted' };
  }
}
