import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { BatchIdsDto } from '../common/batch-ids.dto';
import { MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { OperationBatchService } from './batch.service';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';
import { ClientIp } from '../common/client-ip.decorator';
import { BatchDeleteResponseDto, BatchReconcileResponseDto } from './dto/operation-response.dto';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('operations/batch')
export class OperationBatchController {
  constructor(private readonly batch: OperationBatchService) {}

  @Post('delete')
  @HttpCode(200)
  async delete(
    @CurrentMember() memberId: MemberId,
    @ClientIp() ip: string,
    @Body() dto: BatchIdsDto,
  ): Promise<BatchDeleteResponseDto> {
    const { deletedCount } = await this.batch.batchDelete(memberId, ip, dto.ids);
    return { message: 'Operations deleted', deletedCount };
  }

  @Post('reconcile')
  @HttpCode(200)
  async reconcile(
    @CurrentMember() memberId: MemberId,
    @ClientIp() ip: string,
    @Body() dto: BatchIdsDto,
  ): Promise<BatchReconcileResponseDto> {
    const { reconciledCount } = await this.batch.batchReconcile(memberId, ip, dto.ids);
    return { message: 'Operations reconciled', reconciledCount };
  }
}
