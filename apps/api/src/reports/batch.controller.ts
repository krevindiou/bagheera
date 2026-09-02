import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ReportBatchService } from './batch.service';
import { BatchIdsDto } from '../common/batch-ids.dto';

@Controller('reports/batch')
export class ReportBatchController {
  constructor(private readonly batch: ReportBatchService) {}

  @Post('delete')
  @HttpCode(200)
  async delete(@Req() req: Request, @Body() dto: BatchIdsDto) {
    const { deletedCount } = await this.batch.batchDelete(req, dto.ids);
    return { message: 'Reports deleted', deletedCount };
  }
}
