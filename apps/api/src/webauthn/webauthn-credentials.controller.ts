import { Controller, Delete, Get, HttpCode, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ParseUuidV7Pipe } from '../common/parse-uuid-v7.pipe';
import { RateLimit } from '../security/rate-limit.decorator';
import { WebauthnCredentialsService } from './webauthn-credentials.service';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { WebauthnCredentialSummaryDto } from './dto/webauthn-credential-response.dto';

// Authenticated (no @Public()) — managing one's own passkeys. Removal also
// consumes a fresh step-up proof (see WebauthnCredentialsService.remove).
@Controller('webauthn/credentials')
export class WebauthnCredentialsController {
  constructor(private readonly credentials: WebauthnCredentialsService) {}

  @Get()
  async list(@Req() req: Request): Promise<WebauthnCredentialSummaryDto[]> {
    return this.credentials.list(req);
  }

  @Delete(':id')
  @HttpCode(200)
  @RateLimit({ points: 10, durationSeconds: 60 })
  async remove(
    @Req() req: Request,
    @Param('id', ParseUuidV7Pipe) id: string,
  ): Promise<MessageResponseDto> {
    await this.credentials.remove(req, id);
    return { message: 'ok' };
  }
}
