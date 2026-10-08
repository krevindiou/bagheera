import { MessageResponseDto } from '../common/dto/message-response.dto';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { Public } from '../session/public.decorator';
import { SignupOptionsDto } from './dto/signup-options.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { WebauthnSignupService } from './webauthn-signup.service';

// Public: the caller has no session yet.
@Controller('webauthn/signup')
@Public()
export class WebauthnSignupController {
  constructor(private readonly signup: WebauthnSignupService) {}

  @Post('options')
  @HttpCode(200)
  @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'key' })
  async options(
    @Req() req: Request,
    @Body() dto: SignupOptionsDto,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return this.signup.generateOptions(req, dto);
  }

  @Post('verify')
  @HttpCode(200)
  // IP-only: the body has no identifier. Nothing here is guessable (it
  // needs a signature over this session's own challenge), so the budget
  // only caps raw volume.
  @RateLimit({ points: 30, durationSeconds: 60 })
  async verify(
    @Req() req: Request,
    @Body() dto: VerifyRegistrationDto,
  ): Promise<MessageResponseDto> {
    return this.signup.verify(req, dto);
  }
}
