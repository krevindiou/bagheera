import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { SkipRateLimit } from '../security/skip-rate-limit.decorator';
import { SchedulerBatchService } from './batch.service';
import { BatchIdsDto } from '../common/batch-ids.dto';

// One request per user action, not per row (see BatchIdsDto's own array-size
// cap) — no enumerable secret to brute-force. See SkipRateLimit's doc comment.
@SkipRateLimit()
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
