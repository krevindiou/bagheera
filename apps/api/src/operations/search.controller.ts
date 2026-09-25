import { Body, Controller, Delete, Get, HttpCode, Post, Query } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { MEMBER_SEARCH_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { SearchOperationsDto } from './dto/search-operations.dto';
import { OperationSearchService } from './search.service';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { OperationListDto, OperationSearchRecallDto } from './dto/operation-response.dto';

// Throttled on every verb, reads included: GET re-runs the remembered
// search, just as POST runs a new one.
@RateLimit(MEMBER_SEARCH_LIMIT)
@Controller('operations/search')
export class OperationSearchController {
  constructor(private readonly search: OperationSearchService) {}

  @Post()
  @HttpCode(200)
  run(
    @CurrentMember() memberId: MemberId,
    @Body() dto: SearchOperationsDto,
    @Query('page') page?: string,
  ): Promise<OperationListDto> {
    return this.search.search(memberId, dto, page ? Number(page) : 1);
  }

  @Get()
  recall(
    @CurrentMember() memberId: MemberId,
    @Query('accountId', ParseUuidV7Pipe) accountId: string,
    @Query('page') page?: string,
  ): Promise<OperationSearchRecallDto> {
    return this.search.recallAndRun(memberId, accountId, page ? Number(page) : 1);
  }

  @Delete()
  @HttpCode(200)
  async clear(
    @CurrentMember() memberId: MemberId,
    @Query('accountId', ParseUuidV7Pipe) accountId: string,
  ): Promise<MessageResponseDto> {
    await this.search.clear(memberId, accountId);
    return { message: 'Search cleared' };
  }
}
