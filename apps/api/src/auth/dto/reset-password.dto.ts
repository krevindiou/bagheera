import { NewPasswordField, SecretField } from '../../common/dto-fields';

export class ResetPasswordDto {
  @SecretField()
  key!: string;

  @NewPasswordField()
  password!: string;

  @NewPasswordField()
  passwordConfirmation!: string;
}
