import { Module } from '@nestjs/common';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';

@Module({
  controllers: [RegistrationController, ProfileController],
  providers: [RegistrationService, ProfileService],
  exports: [RegistrationService, ProfileService],
})
export class MembersModule {}
