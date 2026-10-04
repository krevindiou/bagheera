import { Body, Controller, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { MEMBER_SEARCH_LIMIT, MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { OperationService } from './operation.service';
import { OperationSearchService } from './search.service';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { OperationSavedResponseDto, OperationSearchRecallDto } from './dto/operation-response.dto';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('operations')
export class OperationController {
  constructor(
    private readonly operations: OperationService,
    private readonly search: OperationSearchService,
  ) {}

  // The account's operations, filtered by the search remembered for this
  // member+account (see POST /operations/search) — unfiltered when none is.
  // Listing re-runs that search, so it draws on the search budget, shared
  // with the search routes, rather than the write budget above.
  @Get()
  @RateLimit(MEMBER_SEARCH_LIMIT)
  list(
    @CurrentMember() memberId: MemberId,
    @Query('accountId', ParseUuidV7Pipe) accountId: string,
    @Query() { page }: PageQueryDto,
  ): Promise<OperationSearchRecallDto> {
    return this.search.recallAndRun(memberId, accountId, page);
  }

  @Post()
  @HttpCode(200)
  async create(
    @CurrentMember() memberId: MemberId,
    @Body() dto: CreateOperationDto,
  ): Promise<OperationSavedResponseDto> {
    const created = await this.operations.create(memberId, dto);
    return { message: 'Operation saved', operation: created };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentMember() memberId: MemberId,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateOperationDto,
  ): Promise<MessageResponseDto> {
    await this.operations.update(memberId, id, dto);
    return { message: 'Operation saved' };
  }
}
