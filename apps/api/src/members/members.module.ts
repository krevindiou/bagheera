import { Module } from '@nestjs/common';
import { ActivationController } from './activation.controller';
import { ActivationService } from './activation.service';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

@Module({
  controllers: [
    RegistrationController,
    ActivationController,
    ProfileController,
  ],
  providers: [RegistrationService, ActivationService, ProfileService],
  exports: [RegistrationService, ActivationService, ProfileService],
})
export class MembersModule {}
