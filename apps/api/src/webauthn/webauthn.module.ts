import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SessionModule } from '../session/session.module';
import { WebauthnAuthenticationController } from './webauthn-authentication.controller';
import { WebauthnAuthenticationService } from './webauthn-authentication.service';
import { WebauthnCredentialsController } from './webauthn-credentials.controller';
import { WebauthnCredentialsService } from './webauthn-credentials.service';
import { WebauthnCryptoService } from './webauthn-crypto.service';
import { WebauthnRegistrationController } from './webauthn-registration.controller';
import { WebauthnRegistrationService } from './webauthn-registration.service';
import { WebauthnSignupController } from './webauthn-signup.controller';
import { WebauthnSignupService } from './webauthn-signup.service';
import { WebauthnStepUpController } from './webauthn-step-up.controller';
import { WebauthnStepUpService } from './webauthn-step-up.service';

@Module({
  imports: [SessionModule, AuthModule],
  controllers: [
    WebauthnRegistrationController,
    WebauthnAuthenticationController,
    WebauthnCredentialsController,
    WebauthnSignupController,
    WebauthnStepUpController,
  ],
  providers: [
    WebauthnCryptoService,
    WebauthnRegistrationService,
    WebauthnAuthenticationService,
    WebauthnCredentialsService,
    WebauthnSignupService,
    WebauthnStepUpService,
  ],
  exports: [WebauthnCryptoService],
})
export class WebauthnModule {}
