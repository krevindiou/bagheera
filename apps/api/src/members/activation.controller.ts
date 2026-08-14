import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ActivationService } from './activation.service';
import { ActivateDto } from './dto/activate.dto';

@Controller('members')
export class ActivationController {
  constructor(private readonly activation: ActivationService) {}

  @Post('activate')
  @HttpCode(200)
  async activate(@Body() dto: ActivateDto): Promise<{ message: string }> {
    await this.activation.activate(dto.key);
    return { message: 'Account activated. You can now sign in.' };
  }
}
