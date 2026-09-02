import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BatchIdsDto } from '../common/batch-ids.dto';
import { SkipRateLimit } from '../security/skip-rate-limit.decorator';
import { OperationBatchService } from './batch.service';

// One request per user action, not per row (see BatchIdsDto's own array-size
// cap) — no enumerable secret to brute-force. See SkipRateLimit's doc comment.
@SkipRateLimit()
@Controller('operations/batch')
export class OperationBatchController {
  constructor(private readonly batch: OperationBatchService) {}

  @Post('delete')
  @HttpCode(200)
  async delete(@Req() req: Request, @Body() dto: BatchIdsDto) {
    const { deletedCount } = await this.batch.batchDelete(req, dto.ids);
    return { message: 'Operations deleted', deletedCount };
  }

  @Post('reconcile')
  @HttpCode(200)
  async reconcile(@Req() req: Request, @Body() dto: BatchIdsDto) {
    const { reconciledCount } = await this.batch.batchReconcile(req, dto.ids);
    return { message: 'Operations reconciled', reconciledCount };
  }
}
