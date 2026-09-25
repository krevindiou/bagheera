import { MessageResponseDto } from '../common/dto/message-response.dto';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/server';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { VerifyAuthenticationDto } from './dto/verify-authentication.dto';
import { WebauthnStepUpService } from './webauthn-step-up.service';

// Authenticated (no @Public()) — proving you still hold a passkey requires
// an existing signed-in session, same as the old change-password.
@Controller('webauthn/step-up')
export class WebauthnStepUpController {
  constructor(private readonly stepUp: WebauthnStepUpService) {}

  @Post('options')
  @HttpCode(200)
  @RateLimit({ points: 10, durationSeconds: 60 })
  async options(@Req() req: Request): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return this.stepUp.generateOptions(req);
  }

  @Post('verify')
  @HttpCode(200)
  @RateLimit({ points: 10, durationSeconds: 60 })
  async verify(
    @Req() req: Request,
    @Body() dto: VerifyAuthenticationDto,
  ): Promise<MessageResponseDto> {
    return this.stepUp.verify(req, dto);
  }
}
