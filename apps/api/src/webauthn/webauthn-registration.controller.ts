import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/server';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { WebauthnRegistrationService } from './webauthn-registration.service';

// Authenticated (no @Public()) — registering a passkey requires an existing
// signed-in session, same as change-password.
@Controller('webauthn/registration')
export class WebauthnRegistrationController {
  constructor(private readonly registration: WebauthnRegistrationService) {}

  @Post('options')
  @HttpCode(200)
  @RateLimit({ points: 10, durationSeconds: 60 })
  async options(
    @Req() req: Request,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return this.registration.generateOptions(req);
  }

  @Post('verify')
  @HttpCode(200)
  @RateLimit({ points: 10, durationSeconds: 60 })
  async verify(
    @Req() req: Request,
    @Body() dto: VerifyRegistrationDto,
  ): Promise<{ message: string }> {
    await this.registration.verify(req, dto);
    return { message: 'ok' };
  }
}
