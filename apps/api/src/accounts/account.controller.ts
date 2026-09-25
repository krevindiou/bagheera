import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';
import { ClientIp } from '../common/client-ip.decorator';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import {
  AccountBalanceDto,
  AccountChartDto,
  AccountSavedResponseDto,
  AccountWithBalanceDto,
} from './dto/account-response.dto';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('accounts')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  list(
    @CurrentMember() memberId: MemberId,
    @Query('bankId') bankId?: string,
  ): Promise<AccountWithBalanceDto[]> {
    return this.accounts.list(memberId, bankId);
  }

  @Get(':id/chart')
  chart(
    @CurrentMember() memberId: MemberId,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Query('range') range?: string,
  ): Promise<AccountChartDto> {
    return this.accounts.chart(memberId, id, range);
  }

  @Get(':id/balance')
  balance(
    @CurrentMember() memberId: MemberId,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<AccountBalanceDto> {
    return this.accounts.balance(memberId, id);
  }

  @Post()
  @HttpCode(200)
  async create(
    @CurrentMember() memberId: MemberId,
    @Body() dto: CreateAccountDto,
  ): Promise<AccountSavedResponseDto> {
    const created = await this.accounts.create(memberId, dto);
    return { message: 'Account saved', account: created };
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentMember() memberId: MemberId,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateAccountDto,
  ): Promise<MessageResponseDto> {
    await this.accounts.update(memberId, id, dto);
    return { message: 'Account saved' };
  }

  @Post(':id/close')
  @HttpCode(200)
  async close(
    @CurrentMember() memberId: MemberId,
    @ClientIp() ip: string,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<MessageResponseDto> {
    await this.accounts.close(memberId, ip, id);
    return { message: 'Account closed' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @CurrentMember() memberId: MemberId,
    @ClientIp() ip: string,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<MessageResponseDto> {
    await this.accounts.remove(memberId, ip, id);
    return { message: 'Account deleted' };
  }
}
