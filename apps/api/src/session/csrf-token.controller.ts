import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { isNewSession } from './is-new-session';
import { Public } from './public.decorator';
import './session-data';
import { CsrfTokenResponseDto } from './dto/csrf-token-response.dto';

/**
 * Mints a CSRF token for the caller's session. The CSRF cookie is httpOnly,
 * so the SPA calls this before each mutating request and echoes the value
 * in `x-csrf-token`.
 */
@ApiTags('auth')
@Controller('auth')
@Public()
export class CsrfTokenController {
  @Get('csrf-token')
  @ApiOperation({ summary: 'Mint a CSRF token for the current session' })
  // Minting for a caller without a session stores a new one (see below) —
  // the one way an anonymous caller adds a key to Valkey, so that's what's
  // throttled. A caller whose session already exists mints for free: the
  // SPA mints a token per mutation (apps/web/src/api/client.ts).
  @RateLimit({ points: 30, durationSeconds: 60, appliesTo: isNewSession })
  csrfToken(@Req() req: Request): CsrfTokenResponseDto {
    // Persist the session: the token's HMAC is bound to its id, which an
    // unsaved (saveUninitialized: false) session wouldn't keep.
    req.session.csrfIssued = true;
    return { csrfToken: req.csrfToken!() };
  }
}
