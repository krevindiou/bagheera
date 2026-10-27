import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { BatchIdsDto } from '../../common/batch-ids.dto';
import { ClientIp } from '../../common/client-ip.decorator';
import type { MemberId } from '../../security/ids';
import { MEMBER_WRITE_LIMIT } from '../../security/rate-limit.constants';
import { RateLimit } from '../../security/rate-limit.decorator';
import { CurrentMember } from '../../session/current-member.decorator';
import { LabelCorrectionListDto, LabelCorrectionsDeletedDto } from './label-corrections.dto';
import { LabelCorrectionService } from './label-corrections.service';

@Controller('label-corrections')
export class LabelCorrectionController {
  constructor(private readonly corrections: LabelCorrectionService) {}

  @Get()
  list(@CurrentMember() memberId: MemberId): Promise<LabelCorrectionListDto> {
    return this.corrections.list(memberId);
  }

  // A deletion draws on the member's shared write budget.
  @Post('delete')
  @HttpCode(200)
  @RateLimit(MEMBER_WRITE_LIMIT)
  async delete(
    @CurrentMember() memberId: MemberId,
    @ClientIp() ip: string,
    @Body() dto: BatchIdsDto,
  ): Promise<LabelCorrectionsDeletedDto> {
    const { deletedCount } = await this.corrections.delete(memberId, ip, dto.ids);
    return { message: 'Label corrections deleted', deletedCount };
  }
}
