import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { OperationService } from './operation.service';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('operations')
export class OperationController {
  constructor(private readonly operations: OperationService) {}

  @Get()
  list(
    @CurrentMember() memberId: MemberId,
    @Query('accountId', ParseUuidV7Pipe) accountId: string,
    @Query('page') page?: string,
  ) {
    return this.operations.list(memberId, accountId, page ? Number(page) : 1);
  }

  @Post()
  @HttpCode(200)
  async create(
    @CurrentMember() memberId: MemberId,
    @Body() dto: CreateOperationDto,
  ): Promise<{
    message: string;
    operation: Awaited<ReturnType<OperationService['create']>>;
  }> {
    const created = await this.operations.create(memberId, dto);
    return { message: 'Operation saved', operation: created };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentMember() memberId: MemberId,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateOperationDto,
  ): Promise<{ message: string }> {
    await this.operations.update(memberId, id, dto);
    return { message: 'Operation saved' };
  }
}
