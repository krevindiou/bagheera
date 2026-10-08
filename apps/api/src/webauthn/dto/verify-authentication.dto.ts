import { IsObject } from 'class-validator';
import type { AuthenticationResponseJSON } from '@simplewebauthn/server';

export class VerifyAuthenticationDto {
  // verifyAuthenticationResponse() validates the structure itself.
  @IsObject()
  response!: AuthenticationResponseJSON;
}
