import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { SessionRegistryService } from '../session/session-registry.service';

@Injectable()
export class SignOutService {
  constructor(private readonly sessionRegistry: SessionRegistryService) {}

  async signOut(req: Request): Promise<void> {
    const { memberId } = req.session;
    const sessionId = req.sessionID;
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        resolve();
      });
    });
    if (memberId) {
      await this.sessionRegistry.unregister(memberId, sessionId);
    }
  }
}
