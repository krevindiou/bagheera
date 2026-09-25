import { MessageResponseDto } from '../common/dto/message-response.dto';
import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { ClientIp } from '../common/client-ip.decorator';
import type { MemberId } from '../security/ids';
import { CurrentMember } from '../session/current-member.decorator';
import { RateLimit } from '../security/rate-limit.decorator';
import { Public } from '../session/public.decorator';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { UpdateLocaleDto } from './dto/update-locale.dto';
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
  ): Promise<MessageResponseDto> {
    await this.profile.updateEmail(req, dto);
    // Identical response whether or not the new email was already taken by
    // another member — see the service's own doc for why.
    return {
      message:
        "If this email isn't already registered to another account, check it for a link to confirm the change.",
    };
  }

  @Post('locale')
  @HttpCode(200)
  @RateLimit({ points: 10, durationSeconds: 60 })
  async updateLocale(
    @CurrentMember() memberId: MemberId,
    @Body() dto: UpdateLocaleDto,
  ): Promise<MessageResponseDto> {
    await this.profile.updateLocale(memberId, dto);
    return { message: 'Language preference updated.' };
  }

  // Public: reached from the confirmation link mailed to the new address,
  // not from an authenticated session — the token itself (see
  // ProfileService.confirmEmailChange) is what proves the caller controls
  // that mailbox.
  @Post('profile/confirm-email-change')
  @HttpCode(200)
  @Public()
  @RateLimit({ points: 5, durationSeconds: 60, identifierField: 'key' })
  async confirmEmailChange(
    @ClientIp() ip: string,
    @Body() dto: ConfirmEmailChangeDto,
  ): Promise<MessageResponseDto> {
    await this.profile.confirmEmailChange(dto.key, ip);
    return { message: 'Your email address has been updated.' };
  }
}
