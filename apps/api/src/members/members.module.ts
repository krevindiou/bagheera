import { Module } from '@nestjs/common';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

@Module({
  controllers: [RegistrationController, ActivationController],
  providers: [RegistrationService, ActivationService],
  exports: [RegistrationService, ActivationService],
})
export class MembersModule {}
