import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class SignOutService {
  signOut(req: Request): Promise<void> {
    return new Promise((resolve, reject) => {
      req.session.destroy((err) => {
        if (err) {
          reject(err instanceof Error ? err : new Error(String(err)));
          return;
        }
        resolve();
      });
    });
  }
}
