import { COUNTRY_CODES } from '@bagheera/reference-data';
import { Transform } from 'class-transformer';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { EmailField, LocaleField } from '../../common/dto-fields';
import { TIME_ZONE_MAX_LENGTH } from '../../common/local-date';
import type { Locale } from '../../common/locale';

export class RegisterDto {
  @EmailField()
  email!: string;

  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toUpperCase() : value,
  )
  @IsIn(COUNTRY_CODES, { message: 'country must be an ISO 3166-1 alpha-2 code' })
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
