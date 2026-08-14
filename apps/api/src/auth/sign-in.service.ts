import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Request } from 'express';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { AuditService } from '../security/audit.service';
import { HashService } from '../security/hash.service';
import { SessionRotationService } from '../session/session-rotation.service';
import '../session/session-data';
import { SchedulerCatchUpService } from './scheduler-catch-up.service';
import { SignInDto } from './dto/sign-in.dto';

// Unknown email and wrong password are indistinguishable.
const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class SignInService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly hash: HashService,
    private readonly sessionRotation: SessionRotationService,
    private readonly schedulerCatchUp: SchedulerCatchUpService,
    private readonly audit: AuditService,
  ) {}

  async signIn(req: Request, dto: SignInDto): Promise<{ message: string }> {
    const sourceAddress = req.ip ?? 'unknown';
    const [row] = await this.db
      .select()
      .from(member)
      .where(sql`lower(${member.email}) = lower(${dto.email})`);

    // Verify against a hash even for an unknown email, so response timing
    // doesn't leak whether the address exists.
    const passwordOk = await this.hash.verify(
      row?.password ?? DUMMY_HASH,
      dto.password,
    );
    if (!row || !passwordOk) {
      await this.audit.record(
        'sign_in_failure',
        row?.id ?? null,
        sourceAddress,
      );
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    if (!row.active) {
      // Only reachable once the password has already matched, so this
      // doesn't itself leak account existence to an unauthenticated guesser.
      throw new ForbiddenException('Your account is not activated yet.');
    }

    await this.sessionRotation.rotate(req);
    req.session.memberId = row.id;

    await this.db
      .update(member)
      .set({ loggedAt: new Date() })
      .where(eq(member.id, row.id));

    await this.schedulerCatchUp.catchUp(row.id);
    await this.audit.record('sign_in_success', row.id, sourceAddress);

    return { message: 'ok' };
  }
}

// A real Argon2id hash whose corresponding plaintext is never used, so
// `verify()` runs its normal (slow) comparison path for unknown emails too.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$+wZALY3ksdIY+YTtPxkI3Q$Wm/P1KLYDKyjSffEKC8viLnyDUjmmrvu3Cc16BhCgtg';
