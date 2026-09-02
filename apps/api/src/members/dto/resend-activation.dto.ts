import { EmailField, SecretField } from '../../common/dto-fields';

export class ResendActivationDto {
  @EmailField()
  email!: string;

  @SecretField()
  password!: string;
}
