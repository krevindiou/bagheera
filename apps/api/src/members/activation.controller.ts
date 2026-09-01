import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { RateLimitGuard } from '../security/rate-limit.guard';
import { Public } from '../session/public.decorator';
import { ActivationService } from './activation.service';
import { ActivateDto } from './dto/activate.dto';

@Controller('members')
@Public()
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Post('activate')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'key' })
  async activate(
    @Req() req: Request,
    @Body() dto: ActivateDto,
  ): Promise<{ message: string }> {
    await this.activation.activate(dto.key, req.ip ?? 'unknown');
    return { message: 'Account activated. You can now sign in.' };
  }
}
