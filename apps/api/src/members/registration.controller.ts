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
import { RegisterDto } from './dto/register.dto';
import { RegistrationService } from './registration.service';

@Controller('members')
@Public()
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register')
  @HttpCode(201)
  @UseGuards(RateLimitGuard)
  @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'email' })
  async register(
    @Req() req: Request,
    @Body() dto: RegisterDto,
  ): Promise<{ message: string }> {
    await this.registration.register(dto, req.ip ?? 'unknown');
    return {
      message:
        'You are now registered. You will receive an email with a link to activate your account.',
    };
  }
}
