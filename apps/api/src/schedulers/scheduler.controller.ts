import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateSchedulerDto } from './dto/create-scheduler.dto';
import { UpdateSchedulerDto } from './dto/update-scheduler.dto';
import { SchedulerService } from './scheduler.service';

@Controller('schedulers')
export class SchedulerController {
  constructor(private readonly schedulers: SchedulerService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('accountId', ParseIntPipe) accountId: number,
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
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSchedulerDto,
  ): Promise<{ message: string }> {
    await this.schedulers.update(req, id, dto);
    return { message: 'Scheduler saved' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.schedulers.remove(req, id);
    return { message: 'Scheduler deleted' };
  }
}
