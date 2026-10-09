import { Controller, Get, Inject, UnauthorizedException } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { effectiveTimeZone } from '../common/member-today';
import { member } from '../db/schema';
import type { MemberId } from '../security/ids';
import { CurrentMember } from '../session/current-member.decorator';
import { CurrentMemberDto } from './dto/session-response.dto';

@Controller('auth')
export class CurrentSessionController {
  constructor(@Inject(DRIZZLE) private readonly db: NodePgDatabase) {}

  // Lets the SPA restore its session state after a reload: the httpOnly
  // cookie survives, the in-memory member info doesn't. Also 401s when the
  // session's member row no longer exists.
  @Get('me')
  async me(@CurrentMember() memberId: MemberId): Promise<CurrentMemberDto> {
    const [row] = await this.db
      .select({ email: member.email, locale: member.locale, timeZone: member.timeZone })
      .from(member)
      .where(eq(member.id, memberId));

    if (!row) {
      throw new UnauthorizedException();
    }

    return { email: row.email, locale: row.locale, timeZone: effectiveTimeZone(row.timeZone) };
  }
}
