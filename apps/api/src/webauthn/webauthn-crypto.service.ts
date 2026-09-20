import { Injectable } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  GenerateAuthenticationOptionsOpts,
  GenerateRegistrationOptionsOpts,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  VerifiedAuthenticationResponse,
  VerifiedRegistrationResponse,
  VerifyAuthenticationResponseOpts,
  VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';

/**
 * Thin DI wrapper around @simplewebauthn/server's four ceremony functions —
 * the one seam every webauthn-*.service.ts calls through instead of
 * importing the library directly. Exists so code that only needs "some
 * valid session" or "some valid passkey" rather than to prove the ceremony's
 * crypto itself — chiefly test-support/auth-fixture.ts, reused by every
 * unrelated module's integration tests — can `jest.spyOn` the one injected
 * instance instead of `jest.mock`-ing the module in every consuming spec
 * file. This class is a plain pass-through, so the
 * webauthn-*.integration-spec.ts files that DO test the ceremony itself keep
 * working unchanged with their existing `jest.mock('@simplewebauthn/server', ...)`.
 */
@Injectable()
export class WebauthnCryptoService {
  generateRegistrationOptions(
    opts: GenerateRegistrationOptionsOpts,
  ): Promise<PublicKeyCredentialCreationOptionsJSON> {
    return generateRegistrationOptions(opts);
  }

  verifyRegistrationResponse(
    opts: VerifyRegistrationResponseOpts,
  ): Promise<VerifiedRegistrationResponse> {
    return verifyRegistrationResponse(opts);
  }

  generateAuthenticationOptions(
    opts: GenerateAuthenticationOptionsOpts,
  ): Promise<PublicKeyCredentialRequestOptionsJSON> {
    return generateAuthenticationOptions(opts);
  }

  verifyAuthenticationResponse(
    opts: VerifyAuthenticationResponseOpts,
  ): Promise<VerifiedAuthenticationResponse> {
    return verifyAuthenticationResponse(opts);
  }
}
