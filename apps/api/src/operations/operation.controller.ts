import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { OperationService } from './operation.service';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('operations')
export class OperationController {
  constructor(private readonly operations: OperationService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('accountId', ParseUuidV7Pipe) accountId: string,
    @Query('page') page?: string,
  ) {
    return this.operations.list(req, accountId, page ? Number(page) : 1);
  }

  @Post()
  @HttpCode(200)
  async create(
    @Req() req: Request,
    @Body() dto: CreateOperationDto,
  ): Promise<{
    message: string;
    operation: Awaited<ReturnType<OperationService['create']>>;
  }> {
    const created = await this.operations.create(req, dto);
    return { message: 'Operation saved', operation: created };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateOperationDto,
  ): Promise<{ message: string }> {
    await this.operations.update(req, id, dto);
    return { message: 'Operation saved' };
  }
}
