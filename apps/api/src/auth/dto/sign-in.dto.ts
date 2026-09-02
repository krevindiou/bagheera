import { EmailField, SecretField } from '../../common/dto-fields';

export class SignInDto {
  @EmailField()
  email!: string;

  @SecretField()
  password!: string;
}
