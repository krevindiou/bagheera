import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';
import { MEMBER_DASHBOARD_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { DashboardResponseDto } from './dto/dashboard-response.dto';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @RateLimit(MEMBER_DASHBOARD_LIMIT)
  get(
    @CurrentMember() memberId: MemberId,
    @Query('range') range?: string,
  ): Promise<DashboardResponseDto> {
    return this.dashboard.getDashboard(memberId, range);
  }
}
