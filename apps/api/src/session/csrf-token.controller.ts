import { Controller, Get, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from './public.decorator';
import './session-data';

/**
 * Mints a CSRF token for the caller's session. The CSRF cookie itself is
 * httpOnly (never readable by page scripts), so the SPA calls this once at
 * startup and echoes the returned value back via the `x-csrf-token` header
 * on every mutating request — the standard double-submit pattern adapted
 * for an httpOnly cookie.
 */
@ApiTags('auth')
@Controller('auth')
@Public()
export class CsrfTokenController {
  @Get('csrf-token')
  @ApiOperation({ summary: 'Mint a CSRF token for the current session' })
  csrfToken(@Req() req: Request): { csrfToken: string } {
    // Force the session to persist so the id the token's HMAC is derived
    // from stays stable — without this, saveUninitialized:false would drop
    // a never-otherwise-modified session and a later request would see a
    // different id.
    req.session.csrfIssued = true;
    return { csrfToken: req.csrfToken!() };
  }
}
