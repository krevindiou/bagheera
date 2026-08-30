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
import '../session/session-data';

@Controller('auth')
export class CurrentSessionController {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  // Lets the web app restore its client-side session state (Pinia) on a
  // fresh page load — the httpOnly session cookie survives a refresh, but
  // the in-memory member info doesn't, so the client needs a round trip to
  // know it's still signed in before routing decisions are made.
  @Get('me')
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
