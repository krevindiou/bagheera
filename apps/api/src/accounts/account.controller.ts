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
import { MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('accounts')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  list(@Req() req: Request, @Query('bankId') bankId?: string) {
    return this.accounts.list(req, bankId);
  }

  @Get(':id/chart')
  chart(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Query('range') range?: string,
  ) {
    return this.accounts.chart(req, id, range);
  }

  @Get(':id/balance')
  balance(@Req() req: Request, @Param('id', ParseUuidV7Pipe) id: string) {
    return this.accounts.balance(req, id);
  }

  @Post()
  @HttpCode(200)
  async create(
    @Req() req: Request,
    @Body() dto: CreateAccountDto,
  ): Promise<{
    message: string;
    account: Awaited<ReturnType<AccountService['create']>>;
  }> {
    const created = await this.accounts.create(req, dto);
    return { message: 'Account saved', account: created };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<{ message: string }> {
    await this.accounts.update(req, id, dto);
    return { message: 'Account saved' };
  }

  @Post(':id/close')
  @HttpCode(200)
  async close(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<{ message: string }> {
    await this.accounts.close(req, id);
    return { message: 'Account closed' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<{ message: string }> {
    await this.accounts.remove(req, id);
    return { message: 'Account deleted' };
  }
}
