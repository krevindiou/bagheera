import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportDto } from './dto/update-report.dto';
import { ReportService } from './report.service';

@Controller('reports')
export class ReportController {
  constructor(private readonly reports: ReportService) {}

  @Get()
  list(@Req() req: Request) {
    return this.reports.list(req);
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
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateReportDto,
  ): Promise<{ message: string }> {
    await this.reports.update(req, id, dto);
    return { message: 'Report saved' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.reports.remove(req, id);
    return { message: 'Report deleted' };
  }
}
