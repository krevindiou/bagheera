import { EmailField } from '../../common/dto-fields';

export class RequestPasswordResetDto {
  @EmailField()
  email!: string;
}
