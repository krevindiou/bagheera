import { Body, Controller, Delete, Get, HttpCode, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { SkipRateLimit } from '../security/skip-rate-limit.decorator';
import { SearchOperationsDto } from './dto/search-operations.dto';
import { OperationSearchService } from './search.service';

// POST here runs a search (remembering the criteria), not a write to the
// caller's data — scoped to their own operations, no enumerable secret to
// brute-force. See SkipRateLimit's doc comment.
@SkipRateLimit()
@Controller('operations/search')
export class OperationSearchController {
  constructor(private readonly search: OperationSearchService) {}

  @Post()
  @HttpCode(200)
  run(@Req() req: Request, @Body() dto: SearchOperationsDto, @Query('page') page?: string) {
    return this.search.search(req, dto, page ? Number(page) : 1);
  }

  @Get()
  recall(
    @Req() req: Request,
    @Query('accountId', ParseUuidV7Pipe) accountId: string,
    @Query('page') page?: string,
  ) {
    return this.search.recallAndRun(req, accountId, page ? Number(page) : 1);
  }

  @Delete()
  @HttpCode(200)
  async clear(
    @Req() req: Request,
    @Query('accountId', ParseUuidV7Pipe) accountId: string,
  ): Promise<{ message: string }> {
    await this.search.clear(req, accountId);
    return { message: 'Search cleared' };
  }
}
