import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { Public } from '../session/public.decorator';
import { ResendActivationDto } from './dto/resend-activation.dto';
import { ResendActivationService } from './resend-activation.service';

@Controller('members')
@Public()
export class ResendActivationController {
  constructor(private readonly resendActivation: ResendActivationService) {}

  @Post('resend-activation')
  @HttpCode(200)
  @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'email' })
  async resend(
    @Req() req: Request,
    @Body() dto: ResendActivationDto,
  ): Promise<{ message: string }> {
    await this.resendActivation.resend(
      dto.email,
      dto.password,
      req.ip ?? 'unknown',
    );
    return {
      message: 'A new activation email has been sent.',
    };
  }
}
