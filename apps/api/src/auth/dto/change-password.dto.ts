import { NewPasswordField, SecretField } from '../../common/dto-fields';

export class ChangePasswordDto {
  @SecretField()
  currentPassword!: string;

  @NewPasswordField()
  newPassword!: string;

  @NewPasswordField()
  newPasswordConfirmation!: string;
}
