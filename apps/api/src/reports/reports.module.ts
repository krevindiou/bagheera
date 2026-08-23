import { Module } from '@nestjs/common';
import { ReportBatchController } from './batch.controller';
import { ReportBatchService } from './batch.service';
import { ReportChartService } from './chart.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  controllers: [ReportController, ReportBatchController],
  providers: [ReportService, ReportChartService, ReportBatchService],
  exports: [ReportService, ReportChartService],
})
export class ReportsModule {}
