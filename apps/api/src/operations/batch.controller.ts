import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { BatchIdsDto } from './dto/batch-ids.dto';
import { OperationBatchService } from './batch.service';

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
