import { Controller, Delete, Get, HttpCode, Param, Req } from '@nestjs/common';
import type { Request } from 'express';
import { MessageResponseDto } from '../common/dto/message-response.dto';
import { RateLimit } from '../security/rate-limit.decorator';
import { SessionSummaryDto } from './dto/session-summary.dto';
import { SessionsService } from './sessions.service';

// Signed-in only; both revocations also consume a step-up proof.
@Controller('auth/sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get()
  async list(@Req() req: Request): Promise<SessionSummaryDto[]> {
    return this.sessions.list(req);
  }

  /** Signs out every session of the member but this one. */
  @Delete()
  @HttpCode(200)
  @RateLimit({ points: 10, durationSeconds: 60 })
  async revokeOthers(@Req() req: Request): Promise<MessageResponseDto> {
    await this.sessions.revokeOthers(req);
    return { message: 'ok' };
  }

  @Delete(':id')
  @HttpCode(200)
  @RateLimit({ points: 10, durationSeconds: 60 })
  async revoke(@Req() req: Request, @Param('id') id: string): Promise<MessageResponseDto> {
    await this.sessions.revoke(req, id);
    return { message: 'ok' };
  }
}
