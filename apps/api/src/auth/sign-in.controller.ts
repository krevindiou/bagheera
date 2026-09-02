import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseFilters,
} from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { Public } from '../session/public.decorator';
import { SignInDto } from './dto/sign-in.dto';
import { SignInService } from './sign-in.service';
import { SignInThrottleAuditFilter } from './sign-in-throttle-audit.filter';

@Controller('auth')
export class SignInController {
  constructor(private readonly signInService: SignInService) {}

  @Post('sign-in')
  @HttpCode(200)
  @Public()
  @UseFilters(SignInThrottleAuditFilter)
  @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'email' })
  async signIn(
    @Req() req: Request,
    @Body() dto: SignInDto,
  ): Promise<{ message: string }> {
    return this.signInService.signIn(req, dto);
  }
}
