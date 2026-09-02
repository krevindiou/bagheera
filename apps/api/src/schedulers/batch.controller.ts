import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SchedulerBatchService } from './batch.service';
import { BatchIdsDto } from '../common/batch-ids.dto';

@Controller('schedulers/batch')
export class SchedulerBatchController {
  constructor(private readonly batch: SchedulerBatchService) {}

  @Post('delete')
  @HttpCode(200)
  async delete(@Req() req: Request, @Body() dto: BatchIdsDto) {
    const { deletedCount } = await this.batch.batchDelete(req, dto.ids);
    return { message: 'Schedulers deleted', deletedCount };
  }
}
