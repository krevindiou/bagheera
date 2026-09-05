import { SecretField } from '../../common/dto-fields';

export class ConfirmEmailChangeDto {
  @SecretField()
  key!: string;
}
