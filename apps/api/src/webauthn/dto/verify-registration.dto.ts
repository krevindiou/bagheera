import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';

export class VerifyRegistrationDto {
  // verifyRegistrationResponse() validates the structure itself.
  @IsObject()
  response!: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  deviceName?: string;
}
