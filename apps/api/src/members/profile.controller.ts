import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RateLimit } from '../security/rate-limit.decorator';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('members')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Post('profile')
  @HttpCode(200)
  @RateLimit({ points: 5, durationSeconds: 60 })
  async updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto,
  ): Promise<{ message: string }> {
    await this.profile.updateEmail(req, dto);
    // Identical response whether or not the new email was already taken by
    // another member — see the service's own doc for why.
    return {
      message:
        "If this email isn't already registered to another account, it's now updated.",
    };
  }
}
