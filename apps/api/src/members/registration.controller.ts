import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { Public } from '../session/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { RegistrationService } from './registration.service';

@Controller('members')
@Public()
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register')
  @HttpCode(201)
  @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'email' })
  async register(
    @Req() req: Request,
    @Body() dto: RegisterDto,
  ): Promise<{ message: string }> {
    await this.registration.register(dto, req.ip ?? 'unknown');
    // Identical response whether or not the email was already registered —
    // see the service's own doc for why.
    return {
      message:
        "If this email isn't already registered, you'll receive a link to activate your account.",
    };
  }
}
