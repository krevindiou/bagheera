import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../session/session.module';
import { WebauthnAuthenticationController } from './webauthn-authentication.controller';
import { WebauthnAuthenticationService } from './webauthn-authentication.service';
import { WebauthnCredentialsController } from './webauthn-credentials.controller';
import { WebauthnCredentialsService } from './webauthn-credentials.service';
import { WebauthnRegistrationController } from './webauthn-registration.controller';
import { WebauthnRegistrationService } from './webauthn-registration.service';

@Module({
  imports: [SessionModule, AuthModule],
  controllers: [
    WebauthnRegistrationController,
    WebauthnAuthenticationController,
    WebauthnCredentialsController,
  ],
  providers: [
    WebauthnRegistrationService,
    WebauthnAuthenticationService,
    WebauthnCredentialsService,
  ],
})
export class WebauthnModule {}
