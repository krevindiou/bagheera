import {
  Body,
  Controller,
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
import { CreateOperationDto } from './dto/create-operation.dto';
import { UpdateOperationDto } from './dto/update-operation.dto';
import { OperationService } from './operation.service';

@Controller('operations')
export class OperationController {
  constructor(private readonly operations: OperationService) {}

  @Get()
  list(
    @Req() req: Request,
    @Query('accountId', ParseIntPipe) accountId: number,
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
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOperationDto,
  ): Promise<{ message: string }> {
    await this.operations.update(req, id, dto);
    return { message: 'Operation saved' };
  }
}
