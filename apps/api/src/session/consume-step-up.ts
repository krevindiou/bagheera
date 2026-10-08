import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { BusinessError } from '../common/filters/business-error';
import './step-up-session-data';

// How long a verified step-up stays usable: long enough to finish the one
// action it was requested for, short enough that a proof from earlier in
// the session can't be picked up later for something else.
export const STEP_UP_TTL_MS = 5 * 60 * 1000;

/**
 * Gates a sensitive mutation (email change, adding or removing a passkey)
 * on a fresh step-up proof: a stolen cookie or an unattended device would
 * otherwise turn temporary access into a permanent takeover.
 *
 * Consumed on read whatever the outcome, so one ceremony authorizes exactly
 * one action.
 *
 * 422: not malformed input (400), and a 401 would make the web client sign
 * the member out.
 */
export function consumeStepUp(req: Request): void {
  const verifiedAt = req.session.stepUpVerifiedAt;
  delete req.session.stepUpVerifiedAt;
  if (!verifiedAt || Date.now() - verifiedAt > STEP_UP_TTL_MS) {
    throw new BusinessError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'step_up_required',
      'Step-up verification is required or has expired.',
    );
  }
}
