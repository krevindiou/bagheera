import { MessageResponseDto } from '../common/dto/message-response.dto';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { Public } from '../session/public.decorator';
import { VerifyAuthenticationDto } from './dto/verify-authentication.dto';
import { WebauthnAuthenticationService } from './webauthn-authentication.service';

// Public — the caller isn't signed in yet.
@Controller('webauthn/authentication')
@Public()
export class WebauthnAuthenticationController {
  constructor(private readonly authentication: WebauthnAuthenticationService) {}

  // IP-only: sign-in takes no identifier any more (usernameless — see
  // WebauthnAuthenticationService), so there's no per-account dimension an
  // attacker could exhaust to lock someone out. Options only mint a
  // challenge; nothing here is guessable.
  @Post('options')
  @HttpCode(200)
  @RateLimit({ points: 20, durationSeconds: 60 })
  async options(@Req() req: Request): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return this.authentication.generateOptions(req);
  }

  @Post('verify')
  @HttpCode(200)
  @RateLimit({ points: 5, durationSeconds: 60 })
  async verify(
    @Req() req: Request,
    @Body() dto: VerifyAuthenticationDto,
  ): Promise<MessageResponseDto> {
    return this.authentication.verify(req, dto);
  }
}
