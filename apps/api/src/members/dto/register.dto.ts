import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { EmailField, LocaleField } from '../../common/dto-fields';
import { TIME_ZONE_MAX_LENGTH } from '../../common/local-date';
import type { Locale } from '../../common/locale';

export class RegisterDto {
  @EmailField()
  email!: string;

  @Matches(/^[A-Za-z]{2}$/, { message: 'country must be a 2-letter code' })
  country!: string;

  // Whatever locale was active in the registering browser — absent for any
  // client that predates this field. RegistrationService falls back to
  // DEFAULT_LOCALE when it's missing.
  @IsOptional()
  @LocaleField()
  locale?: Locale;

  // The registering browser's IANA time zone, likewise absent for older
  // clients: the member then follows APP_TIMEZONE (see member.time_zone).
  // Not validated as a zone here: one this server doesn't know is dropped
  // by RegistrationService rather than failing the whole sign-up.
  @IsOptional()
  @IsString()
  @MaxLength(TIME_ZONE_MAX_LENGTH)
  timeZone?: string;
}
