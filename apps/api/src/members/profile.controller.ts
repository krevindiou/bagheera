import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('members')
export class ProfileController {
  constructor(private readonly profile: ProfileService) {}

  @Post('profile')
  @HttpCode(200)
  async updateProfile(
    @Req() req: Request,
    @Body() dto: UpdateProfileDto,
  ): Promise<{ message: string }> {
    await this.profile.updateEmail(req, dto);
    return { message: 'Profile updated' };
  }
}
