import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { SkipRateLimit } from '../security/skip-rate-limit.decorator';
import { CreateSchedulerDto } from './dto/create-scheduler.dto';
import { UpdateSchedulerDto } from './dto/update-scheduler.dto';
import { SchedulerService } from './scheduler.service';

// Ordinary authenticated CRUD, scoped to the caller's own schedulers — no
// enumerable secret to brute-force. See SkipRateLimit's doc comment.
@SkipRateLimit()
@Controller('schedulers')
export class SchedulerController {
  constructor(private readonly schedulers: SchedulerService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('accountId', ParseUuidV7Pipe) accountId: string,
    @Query('page') page?: string,
  ) {
    return this.schedulers.list(req, accountId, page ? Number(page) : 1);
  }

  @Post()
  @HttpCode(200)
  async create(
    @Req() req: Request,
    @Body() dto: CreateSchedulerDto,
  ): Promise<{
    message: string;
    scheduler: Awaited<ReturnType<SchedulerService['create']>>;
  }> {
    const created = await this.schedulers.create(req, dto);
    return { message: 'Scheduler saved', scheduler: created };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateSchedulerDto,
  ): Promise<{ message: string }> {
    await this.schedulers.update(req, id, dto);
    return { message: 'Scheduler saved' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<{ message: string }> {
    await this.schedulers.remove(req, id);
    return { message: 'Scheduler deleted' };
  }
}
