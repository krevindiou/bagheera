import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../session/public.decorator';
import { SkipRateLimit } from '../security/skip-rate-limit.decorator';
import { SignOutService } from './sign-out.service';

@Controller('auth')
export class SignOutController {
  constructor(private readonly signOutService: SignOutService) {}

  // Can only act on the caller's own already-authenticated session —
  // nothing to brute-force or spam-drain. See SkipRateLimit's doc comment.
  @Post('sign-out')
  @HttpCode(200)
  @Public()
  @SkipRateLimit()
  async signOut(@Req() req: Request): Promise<{ message: string }> {
    await this.signOutService.signOut(req);
    return { message: 'ok' };
  }
}
