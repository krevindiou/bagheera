import { Injectable } from '@nestjs/common';
import * as argon2 from 'argon2';

/**
 * Password hashing via Argon2id.
 */
@Injectable()
export class HashService {
  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, { type: argon2.argon2id });
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch {
      // Malformed/foreign hash strings throw rather than returning false.
      return false;
    }
  }
}
