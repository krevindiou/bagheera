import { EmailField, SecretField } from '../../common/dto-fields';

export class UpdateProfileDto {
  @EmailField()
  email!: string;

  @SecretField()
  currentPassword!: string;
}
