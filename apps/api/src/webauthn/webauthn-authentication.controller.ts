import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { Public } from '../session/public.decorator';
import { AuthenticationOptionsDto } from './dto/authentication-options.dto';
import { VerifyAuthenticationDto } from './dto/verify-authentication.dto';
import { WebauthnAuthenticationService } from './webauthn-authentication.service';

// Public — the caller isn't signed in yet, same as SignInController.
@Controller('webauthn/authentication')
@Public()
export class WebauthnAuthenticationController {
  constructor(private readonly authentication: WebauthnAuthenticationService) {}

  @Post('options')
  @HttpCode(200)
  @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'email' })
  async options(
    @Req() req: Request,
    @Body() dto: AuthenticationOptionsDto,
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return this.authentication.generateOptions(req, dto);
  }

  @Post('verify')
  @HttpCode(200)
  @RateLimit({ points: 5, durationSeconds: 60 })
  async verify(
    @Req() req: Request,
    @Body() dto: VerifyAuthenticationDto,
  ): Promise<{ message: string }> {
    return this.authentication.verify(req, dto);
  }
}
