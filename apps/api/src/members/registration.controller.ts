import { Body, Controller, HttpCode, Post, Req } from '@nestjs/common';
import type { Request } from 'express';
import { RegisterDto } from './dto/register.dto';
import { RegistrationService } from './registration.service';

@Controller('members')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register')
  @HttpCode(201)
  async register(
    @Req() req: Request,
    @Body() dto: RegisterDto,
  ): Promise<{ message: string }> {
    await this.registration.register(dto, req.ip ?? 'unknown');
    return {
      message:
        'You are now registered. You will receive an email with a link to activate your account.',
    };
  }
}
