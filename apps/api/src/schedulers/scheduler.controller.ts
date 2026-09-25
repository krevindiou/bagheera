import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { CreateSchedulerDto } from './dto/create-scheduler.dto';
import { UpdateSchedulerDto } from './dto/update-scheduler.dto';
import { SchedulerService } from './scheduler.service';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { SchedulerListDto, SchedulerSavedResponseDto } from './dto/scheduler-response.dto';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('schedulers')
export class SchedulerController {
  constructor(private readonly schedulers: SchedulerService) {}

  @Get()
  list(
    @CurrentMember() memberId: MemberId,
    @Query('accountId', ParseUuidV7Pipe) accountId: string,
    @Query('page') page?: string,
  ): Promise<SchedulerListDto> {
    return this.schedulers.list(memberId, accountId, page ? Number(page) : 1);
  }

  @Post()
  @HttpCode(200)
  async create(
    @CurrentMember() memberId: MemberId,
    @Body() dto: CreateSchedulerDto,
  ): Promise<SchedulerSavedResponseDto> {
    const created = await this.schedulers.create(memberId, dto);
    return { message: 'Scheduler saved', scheduler: created };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentMember() memberId: MemberId,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateSchedulerDto,
  ): Promise<MessageResponseDto> {
    await this.schedulers.update(memberId, id, dto);
    return { message: 'Scheduler saved' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @CurrentMember() memberId: MemberId,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<MessageResponseDto> {
    await this.schedulers.remove(memberId, id);
    return { message: 'Scheduler deleted' };
  }
}
