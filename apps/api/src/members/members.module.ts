import { Module } from '@nestjs/common';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { ResendActivationController } from './resend-activation.controller';
import { ResendActivationService } from './resend-activation.service';

@Module({
  controllers: [
    RegistrationController,
    ActivationController,
    ResendActivationController,
    ProfileController,
  ],
  providers: [
    RegistrationService,
    ActivationService,
    ResendActivationService,
    ProfileService,
  ],
  exports: [RegistrationService, ActivationService, ProfileService],
})
export class MembersModule {}
