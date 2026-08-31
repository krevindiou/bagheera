import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../session/public.decorator';
import { ActivationService } from './activation.service';
import { ActivateDto } from './dto/activate.dto';

@Controller('members')
@Public()
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Post('activate')
  @HttpCode(200)
  async activate(
    @Req() req: Request,
    @Body() dto: ActivateDto,
  ): Promise<{ message: string }> {
    await this.activation.activate(dto.key, req.ip ?? 'unknown');
    return { message: 'Account activated. You can now sign in.' };
  }
}
