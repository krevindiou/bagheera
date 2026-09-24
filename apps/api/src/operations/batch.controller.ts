import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BatchIdsDto } from '../common/batch-ids.dto';
import { MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { OperationBatchService } from './batch.service';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
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
