import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { RegisterDto } from './dto/register.dto';
import { RegistrationService } from './registration.service';

@Controller('members')
export class RegistrationController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto): Promise<{ message: string }> {
    await this.registration.register(dto);
    return {
      message:
        'You are now registered. You will receive an email with a link to activate your account.',
    };
  }
}
