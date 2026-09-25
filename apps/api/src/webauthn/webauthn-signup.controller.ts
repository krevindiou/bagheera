import { MessageResponseDto } from '../common/dto/message-response.dto';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { Public } from '../session/public.decorator';
import { SignupOptionsDto } from './dto/signup-options.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { WebauthnSignupService } from './webauthn-signup.service';

// Public — reached with no session yet, same as WebauthnAuthenticationController.
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
  // No identifierField: there's nothing in this body to key a second
  // dimension off (unlike options's `key`), so this is IP-only. Verify()
  // itself isn't a guessable-credential surface (it requires a signature
  // over a challenge only this caller's own prior options() call stashed),
  // so a generous budget here mainly protects against raw request-volume
  // abuse, not brute-forcing — same reasoning that keeps
  // WebauthnRegistrationController's own verify() endpoint IP-only.
  @RateLimit({ points: 30, durationSeconds: 60 })
  async verify(
    @Req() req: Request,
    @Body() dto: VerifyRegistrationDto,
  ): Promise<MessageResponseDto> {
    return this.signup.verify(req, dto);
  }
}
