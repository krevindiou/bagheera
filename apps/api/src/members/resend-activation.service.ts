import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { sql } from 'drizzle-orm';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../db/db.constants';
import { member } from '../db/schema';
import { HashService } from '../security/hash.service';
import { ActivationService } from './activation.service';

// Unknown email and wrong password are indistinguishable — same rationale
// as the sign-in flow this action is reached from.
const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class ResendActivationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: NodePgDatabase,
    private readonly hash: HashService,
    private readonly activation: ActivationService,
  ) {}

  async resend(
    email: string,
    password: string,
    sourceAddress = 'unknown',
  ): Promise<void> {
    const [row] = await this.db
      .select()
      .from(member)
      .where(sql`lower(${member.email}) = lower(${email})`);

    // Verify against a hash even for an unknown email, so response timing
    // doesn't leak whether the address exists.
    const passwordOk = await this.hash.verify(
      row?.password ?? DUMMY_HASH,
      password,
    );
    if (!row || !passwordOk) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    // `reissue()` itself silently no-ops for an already-active member, so
    // this call is safe regardless of the member's current state.
    await this.activation.reissue(row.email, sourceAddress);
  }
}

// A real Argon2id hash whose corresponding plaintext is never used, so
// `verify()` runs its normal (slow) comparison path for unknown emails too.
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,p=4,t=3$+wZALY3ksdIY+YTtPxkI3Q$Wm/P1KLYDKyjSffEKC8viLnyDUjmmrvu3Cc16BhCgtg';
