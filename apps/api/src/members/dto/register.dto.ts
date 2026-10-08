import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { EmailField, LocaleField } from '../../common/dto-fields';
import { TIME_ZONE_MAX_LENGTH } from '../../common/local-date';
import type { Locale } from '../../common/locale';

export class RegisterDto {
  @EmailField()
  email!: string;

  @Matches(/^[A-Za-z]{2}$/, { message: 'country must be a 2-letter code' })
  country!: string;

  // The registering browser's locale; DEFAULT_LOCALE when absent.
  @IsOptional()
  @LocaleField()
  locale?: Locale;

  // The browser's IANA zone. Not validated here: RegistrationService drops
  // an unknown one rather than failing the sign-up.
  @IsOptional()
  @IsString()
  @MaxLength(TIME_ZONE_MAX_LENGTH)
  timeZone?: string;
}
