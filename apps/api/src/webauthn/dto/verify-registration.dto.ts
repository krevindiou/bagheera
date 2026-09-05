import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

export class VerifyRegistrationDto {
  // The attestation response's exact shape is authenticator/browser-defined
  // and verified structurally by verifyRegistrationResponse() itself —
  // class-validator only needs to confirm the caller sent an object at all.
  @IsObject()
  response!: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}
