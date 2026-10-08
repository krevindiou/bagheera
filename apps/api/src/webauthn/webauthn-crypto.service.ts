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
 * Pass-through DI wrapper around @simplewebauthn/server's ceremony
 * functions, so integration specs can `vi.spyOn` the injected instance
 * rather than `vi.mock` the library.
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
