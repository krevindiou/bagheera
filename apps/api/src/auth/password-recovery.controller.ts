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
import { RequestPasswordResetDto } from './dto/request-password-reset.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { PasswordRecoveryService } from './password-recovery.service';

const REQUEST_MESSAGE =
  'If an account exists for this address, a password reset link has been sent.';

@Controller('auth')
@Public()
export class PasswordRecoveryController {
  constructor(private readonly passwordRecovery: PasswordRecoveryService) {}

  @Post('password-recovery')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'email' })
  async requestReset(
    @Req() req: Request,
    @Body() dto: RequestPasswordResetDto,
  ): Promise<{ message: string }> {
    await this.passwordRecovery.requestReset(dto.email, req.ip ?? 'unknown');
    // Identical response whether or not the address matched — see 2.4 the
    // service's own doc for why.
    return { message: REQUEST_MESSAGE };
  }

  @Post('password-recovery/reset')
  @HttpCode(200)
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'key' })
  async resetPassword(
    @Req() req: Request,
    @Body() dto: ResetPasswordDto,
  ): Promise<{ message: string }> {
    await this.passwordRecovery.resetPassword(
      dto.key,
      dto.password,
      dto.passwordConfirmation,
      req.ip ?? 'unknown',
    );
    return { message: 'Your password has been updated.' };
  }
}
