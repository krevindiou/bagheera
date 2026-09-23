import { UnprocessableEntityException } from '@nestjs/common';
import type { Request } from 'express';
import './step-up-session-data';

// How long a verified step-up stays usable: long enough to finish the one
// action it was requested for, short enough that a proof from earlier in
// the session can't be picked up later for something else.
export const STEP_UP_TTL_MS = 5 * 60 * 1000;

/**
 * Gates a sensitive mutation — an email change, adding a passkey, removing
 * one — on a fresh step-up proof (see WebauthnStepUpService, the
 * passkey-era analog of "enter your current password"). A signed-in session
 * alone isn't enough for these: a stolen cookie or an unlocked, unattended
 * device carries one too, and adding a passkey or swapping the email is how
 * that temporary access becomes a permanent takeover.
 *
 * Consumed on read regardless of outcome — single-use, not just
 * time-bounded — so one ceremony authorizes exactly one action and a stale
 * flag can never gate a second, unrelated one.
 *
 * 422, not 400: this isn't malformed input (what 400 means elsewhere, see
 * error-response.ts) but a credential-check-equivalent failing, the same
 * bucket requireFullyActive() uses for a business-rule denial — and it can
 * never collide with the reserved "no active session" meaning of a bare 401
 * (see apps/web/src/api/client.ts's onResponse).
 */
export function consumeStepUp(req: Request): void {
  const verifiedAt = req.session.stepUpVerifiedAt;
  delete req.session.stepUpVerifiedAt;
  if (!verifiedAt || Date.now() - verifiedAt > STEP_UP_TTL_MS) {
    throw new UnprocessableEntityException('Step-up verification is required or has expired.');
  }
}
