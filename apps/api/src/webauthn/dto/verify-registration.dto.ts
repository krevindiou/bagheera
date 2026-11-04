import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import { FIELD_LIMITS } from '@bagheera/reference-data';
import { NoNul } from '../../common/dto-fields';

export class VerifyRegistrationDto {
  // verifyRegistrationResponse() validates the structure itself.
  @IsObject()
  response!: RegistrationResponseJSON;

  @IsOptional()
  @IsString()
  @NoNul()
  @MaxLength(FIELD_LIMITS.DEVICE_NAME)
  deviceName?: string;
}
