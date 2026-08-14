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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { BankService, ChooseBankResult } from './bank.service';
import { ChooseBankDto } from './dto/choose-bank.dto';
import { UpdateBankDto } from './dto/update-bank.dto';

@Controller('banks')
export class BankController {
  constructor(private readonly banks: BankService) {}

  @Get()
  list(@Req() req: Request) {
    return this.banks.list(req);
  }

  @Post('choice')
  @HttpCode(200)
  choose(
    @Req() req: Request,
    @Body() dto: ChooseBankDto,
  ): Promise<ChooseBankResult> {
    return this.banks.choose(req, dto);
  }

  @Patch(':id')
  @HttpCode(200)
  async update(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBankDto,
  ): Promise<{ message: string }> {
    await this.banks.update(req, id, dto);
    return { message: 'Bank saved' };
  }

  @Post(':id/close')
  @HttpCode(200)
  async close(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.banks.close(req, id);
    return { message: 'Bank closed' };
  }

  @Delete(':id')
  @HttpCode(200)
  async remove(
    @Req() req: Request,
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ message: string }> {
    await this.banks.remove(req, id);
    return { message: 'Bank deleted' };
  }
}
