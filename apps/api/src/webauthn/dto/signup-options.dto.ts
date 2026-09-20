import { SecretField } from '../../common/dto-fields';

export class SignupOptionsDto {
  @SecretField()
  key!: string;
}
