import { Module } from '@nestjs/common';
import { ReportChartService } from './chart.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  controllers: [ReportController],
  providers: [ReportService, ReportChartService],
  exports: [ReportService, ReportChartService],
})
export class ReportsModule {}
