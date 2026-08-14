import { Injectable } from '@nestjs/common';
import { Request } from 'express';

/**
 * Rotates the session id while preserving session data — used after
 * sign-in and on other privilege-boundary crossings to defeat session
 * fixation.
 */
@Injectable()
export class SessionRotationService {
  rotate(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      const data: Record<string, unknown> = { ...req.session };
      delete data.cookie;
      req.session.regenerate((err) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        Object.assign(req.session, data);
        req.session.save((saveErr) => {
          if (saveErr) {
            reject(
              saveErr instanceof Error ? saveErr : new Error(String(saveErr)),
            );
            return;
          }
          resolve();
        });
      });
    });
  }
}
