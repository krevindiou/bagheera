import { Body, Controller, Delete, HttpCode, Post, Query } from '@nestjs/common';
import { PageQueryDto } from '../common/dto/page-query.dto';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { MEMBER_SEARCH_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { SearchOperationsDto } from './dto/search-operations.dto';
import { OperationSearchService } from './search.service';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { OperationListDto } from './dto/operation-response.dto';

// The member+account's remembered search: POST sets it (and returns its
// first page), DELETE clears it. Listing itself is GET /operations, which
// re-runs whatever is remembered here and shares this search budget.
@RateLimit(MEMBER_SEARCH_LIMIT)
@Controller('operations/search')
export class OperationSearchController {
  constructor(private readonly search: OperationSearchService) {}

  @Post()
  @HttpCode(200)
  run(
    @CurrentMember() memberId: MemberId,
    @Body() dto: SearchOperationsDto,
    @Query() { page }: PageQueryDto,
  ): Promise<OperationListDto> {
    return this.search.search(memberId, dto, page);
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
