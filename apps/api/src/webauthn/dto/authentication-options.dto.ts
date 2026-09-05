import { EmailField } from '../../common/dto-fields';

export class AuthenticationOptionsDto {
  @EmailField()
  email!: string;
}
