import { IsObject } from 'class-validator';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export class VerifyAuthenticationDto {
  // Same rationale as VerifyRegistrationDto: verifyAuthenticationResponse()
  // does the structural validation.
  @IsObject()
  response!: AuthenticationResponseJSON;
}
