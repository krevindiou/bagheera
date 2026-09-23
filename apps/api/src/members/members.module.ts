import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { SignupRequestService } from './signup-request.service';

@Module({
  controllers: [RegistrationController, ProfileController],
  providers: [RegistrationService, ProfileService, SignupRequestService],
  exports: [RegistrationService, ProfileService, SignupRequestService],
})
export class MembersModule {}
