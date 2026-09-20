import { IsOptional, Matches } from 'class-validator';
import { EmailField, LocaleField, NewPasswordField } from '../../common/dto-fields';
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

  @NewPasswordField()
  password!: string;

  @NewPasswordField()
  passwordConfirmation!: string;
}
