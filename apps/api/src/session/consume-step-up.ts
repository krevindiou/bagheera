import { HttpStatus } from '@nestjs/common';
import type { Request } from 'express';
import { BusinessError } from '../common/filters/business-error';
import './session-data';
import type { SingleUseStore } from './single-use-store';

// How long a verified step-up stays usable: long enough to finish the one
// action it was requested for, short enough that a proof from earlier in
// the session can't be picked up later for something else.
export const STEP_UP_TTL_MS = 5 * 60 * 1000;

/** Records a step-up proof for `memberId`, replacing any unspent one. */
export function grantStepUp(store: SingleUseStore, req: Request, memberId: string): Promise<void> {
  return store.put(req, 'stepUpProof', { memberId }, STEP_UP_TTL_MS);
}

/**
 * Gates a sensitive mutation (email change, adding or removing a passkey)
 * on a fresh step-up proof: a stolen cookie or an unattended device would
 * otherwise turn temporary access into a permanent takeover.
 *
 * Consumed on read whatever the outcome, and atomically, so one ceremony
 * authorizes exactly one action, even across overlapping requests, and only
 * for the member who proved it.
 *
 * 422: not malformed input (400), and a 401 would make the web client sign
 * the member out.
 */
export async function consumeStepUp(store: SingleUseStore, req: Request): Promise<void> {
  const proof = await store.take(req, 'stepUpProof');
  if (!proof || proof.memberId !== req.session.memberId) {
    throw new BusinessError(
      HttpStatus.UNPROCESSABLE_ENTITY,
      'step_up_required',
      'Step-up verification is required or has expired.',
    );
  }
}
