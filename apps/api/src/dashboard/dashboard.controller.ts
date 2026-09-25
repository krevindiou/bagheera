import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@CurrentMember() memberId: MemberId, @Query('range') range?: string) {
    return this.dashboard.getDashboard(memberId, range);
  }
}
