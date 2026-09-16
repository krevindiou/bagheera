import { Controller, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  get(@Req() req: Request, @Query('range') range?: string) {
    return this.dashboard.getDashboard(req, range);
  }
}
