import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { ReportBatchService } from './batch.service';
import { BatchIdsDto } from '../common/batch-ids.dto';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';
import { ClientIp } from '../common/client-ip.decorator';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('reports/batch')
export class ReportBatchController {
  constructor(private readonly batch: ReportBatchService) {}

  @Post('delete')
  @HttpCode(200)
  async delete(
    @CurrentMember() memberId: MemberId,
    @ClientIp() ip: string,
    @Body() dto: BatchIdsDto,
  ) {
    const { deletedCount } = await this.batch.batchDelete(memberId, ip, dto.ids);
    return { message: 'Reports deleted', deletedCount };
  }
}
