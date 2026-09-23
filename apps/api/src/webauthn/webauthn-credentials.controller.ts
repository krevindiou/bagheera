import { Controller, Delete, Get, HttpCode, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { RateLimit } from '../security/rate-limit.decorator';
import {
  WebauthnCredentialSummary,
  WebauthnCredentialsService,
} from './webauthn-credentials.service';

// Authenticated (no @Public()) — managing one's own passkeys. Removal also
// consumes a fresh step-up proof (see WebauthnCredentialsService.remove).
@Controller('webauthn/credentials')
export class WebauthnCredentialsController {
  constructor(private readonly credentials: WebauthnCredentialsService) {}

  @Get()
  async list(@Req() req: Request): Promise<WebauthnCredentialSummary[]> {
    return this.credentials.list(req);
  }

  @Delete(':id')
  @HttpCode(200)
  @RateLimit({ points: 10, durationSeconds: 60 })
  async remove(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<{ message: string }> {
    await this.credentials.remove(req, id);
    return { message: 'ok' };
  }
}
