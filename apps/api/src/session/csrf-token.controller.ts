import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { isNewSession } from './is-new-session';
import { Public } from './public.decorator';
import './session-data';
import { CsrfTokenResponseDto } from './dto/csrf-token-response.dto';

/**
 * Mints a CSRF token for the caller's session. The CSRF cookie itself is
 * httpOnly (never readable by page scripts), so the SPA calls this before
 * each mutating request and echoes the returned value back via the
 * `x-csrf-token` header — the standard double-submit pattern adapted for an
 * httpOnly cookie.
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
    // Force the session to persist so the id the token's HMAC is derived
    // from stays stable — without this, saveUninitialized:false would drop
    // a never-otherwise-modified session and a later request would see a
    // different id.
    req.session.csrfIssued = true;
    return { csrfToken: req.csrfToken!() };
  }
}
