import { Matches } from 'class-validator';
import { EmailField, NewPasswordField } from '../../common/dto-fields';

export class RegisterDto {
  @EmailField()
  email!: string;

  @Matches(/^[A-Za-z]{2}$/, { message: 'country must be a 2-letter code' })
  country!: string;

  @NewPasswordField()
  password!: string;

  @NewPasswordField()
  passwordConfirmation!: string;
}
