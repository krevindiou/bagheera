import { Module } from '@nestjs/common';
import { ReportBatchController } from './batch.controller';
import { ReportBatchService } from './batch.service';
import { ReportController } from './report.controller';
import { ReportDistributionService } from './report-distribution.service';
import { ReportSeriesService } from './report-series.service';
import { ReportService } from './report.service';

@Module({
  controllers: [ReportController, ReportBatchController],
  providers: [ReportService, ReportSeriesService, ReportDistributionService, ReportBatchService],
  exports: [ReportService, ReportSeriesService, ReportDistributionService],
})
export class ReportsModule {}
