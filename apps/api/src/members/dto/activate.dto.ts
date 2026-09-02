import { SecretField } from '../../common/dto-fields';

export class ActivateDto {
  @SecretField()
  key!: string;
}
