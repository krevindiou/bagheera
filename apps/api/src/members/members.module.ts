import { Module } from '@nestjs/common';
import { SessionModule } from '../session/session.module';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { RegistrationController } from './registration.controller';
import { RegistrationService } from './registration.service';
import { SignupMailThrottle } from './signup-mail-throttle';
import { SignupRequestService } from './signup-request.service';

@Module({
  imports: [SessionModule],
  controllers: [RegistrationController, ProfileController],
  providers: [RegistrationService, ProfileService, SignupRequestService, SignupMailThrottle],
  exports: [RegistrationService, ProfileService, SignupRequestService],
})
export class MembersModule {}
