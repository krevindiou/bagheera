import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from '@nestjs/common';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { MEMBER_WRITE_LIMIT } from '../security/rate-limit.constants';
import { RateLimit } from '../security/rate-limit.decorator';
import { BankService, ChooseBankResult } from './bank.service';
import { ChooseBankDto } from './dto/choose-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';
import { CurrentMember } from '../session/current-member.decorator';
import type { MemberId } from '../security/ids';
import { ClientIp } from '../common/client-ip.decorator';

// Every write here draws on the member's shared write budget.
@RateLimit(MEMBER_WRITE_LIMIT)
@Controller('banks')
export class BankController {
  constructor(private readonly banks: BankService) {}

  @Get()
  list(@CurrentMember() memberId: MemberId) {
    return this.banks.list(memberId);
  }

  @Post('choice')
  @HttpCode(200)
  choose(
    @CurrentMember() memberId: MemberId,
    @Body() dto: ChooseBankDto,
  ): Promise<ChooseBankResult> {
    return this.banks.choose(memberId, dto);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @CurrentMember() memberId: MemberId,
    @Param('id', ParseUuidV7Pipe) id: string,
    @Body() dto: UpdateBankDto,
  ): Promise<{ message: string }> {
    await this.banks.update(memberId, id, dto);
    return { message: 'Bank saved' };
  }

  @Post(':id/close')
  @HttpCode(200)
  async close(
    @CurrentMember() memberId: MemberId,
    @ClientIp() ip: string,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<{ message: string }> {
    await this.banks.close(memberId, ip, id);
    return { message: 'Bank closed' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @CurrentMember() memberId: MemberId,
    @ClientIp() ip: string,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<{ message: string }> {
    await this.banks.remove(memberId, ip, id);
    return { message: 'Bank deleted' };
  }
}
