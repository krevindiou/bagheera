import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import './session-data';

/**
 * Rotates the session id on sign-in and sign-up completion, to defeat
 * session fixation. Only the browser-level fields below carry over; the
 * caller sets `memberId` afterwards.
 *
 * An allow-list, so a field added later is dropped by default: a step-up
 * proof, a pending challenge or sign-up state belongs to whoever held the
 * session before, and carrying it over would let them act on the account
 * signed in next on the same browser.
 */
@Injectable()
export class SessionRotationService {
  rotate(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      const { createdAt, csrfIssued } = req.session;
      req.session.regenerate((err) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        Object.assign(req.session, { createdAt, csrfIssued });
        req.session.save((saveErr) => {
          if (saveErr) {
            reject(saveErr instanceof Error ? saveErr : new Error(String(saveErr)));
            return;
          }
          resolve();
        });
      });
    });
  }
}
