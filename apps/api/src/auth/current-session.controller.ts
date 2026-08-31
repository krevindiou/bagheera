import {
  Controller,
  Get,
  Inject,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { Public } from '../session/public.decorator';
import '../session/session-data';

@Controller('auth')
export class CurrentSessionController {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  // Lets the web app restore its client-side session state (Pinia) on a
  // fresh page load — the httpOnly session cookie survives a refresh, but
  // the in-memory member info doesn't, so the client needs a round trip to
  // know it's still signed in before routing decisions are made. Public
  // because an anonymous caller must get a clean 401 here, not have
  // SessionAuthGuard reject the request before this handler's own check
  // runs (same outcome, but this is the one that also verifies the member
  // row still exists).
  @Get('me')
  @Public()
  async me(@Req() req: Request): Promise<{ email: string }> {
    const memberId = req.session.memberId;
    if (!memberId) {
      throw new UnauthorizedException();
    }

    const [row] = await this.db
      .select({ email: member.email })
      .from(member)
      .where(eq(member.id, memberId));

    if (!row) {
      throw new UnauthorizedException();
    }

    return { email: row.email };
  }
}
