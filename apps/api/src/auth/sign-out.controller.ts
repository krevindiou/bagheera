import { Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../session/public.decorator';
import { SignOutService } from './sign-out.service';

@Controller('auth')
export class SignOutController {
  constructor(private readonly signOutService: SignOutService) {}

  @Post('sign-out')
  @HttpCode(200)
  @Public()
  async signOut(@Req() req: Request): Promise<{ message: string }> {
    await this.signOutService.signOut(req);
    return { message: 'ok' };
  }
}
