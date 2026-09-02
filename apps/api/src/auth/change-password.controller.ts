import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { ChangePasswordService } from './change-password.service';
import { ChangePasswordDto } from './dto/change-password.dto';

@Controller('auth')
export class ChangePasswordController {
  constructor(private readonly changePassword: ChangePasswordService) {}

  @Post('change-password')
  @HttpCode(200)
  @RateLimit({ points: 5, durationSeconds: 60 })
  async changePasswordHandler(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
  ): Promise<{ message: string }> {
    await this.changePassword.changePassword(req, dto);
    return { message: 'ok' };
  }
}
