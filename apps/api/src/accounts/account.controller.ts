import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AccountService } from './account.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { UpdateAccountDto } from './dto/update-account.dto';

@Controller('accounts')
export class AccountController {
  constructor(private readonly accounts: AccountService) {}

  @Get()
  list(@Req() req: Request, @Query('bankId') bankId?: string) {
    return this.accounts.list(req, bankId ? Number(bankId) : undefined);
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
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAccountDto,
  ): Promise<{ message: string }> {
    await this.accounts.update(req, id, dto);
    return { message: 'Account saved' };
  }

  @Post(':id/close')
  @HttpCode(200)
  async close(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.accounts.close(req, id);
    return { message: 'Account closed' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.accounts.remove(req, id);
    return { message: 'Account deleted' };
  }
}
