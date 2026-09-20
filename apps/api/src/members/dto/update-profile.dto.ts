import { EmailField } from '../../common/dto-fields';

export class UpdateProfileDto {
  @EmailField()
  email!: string;
}
