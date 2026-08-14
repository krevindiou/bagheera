import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @Length(8, 4096)
  newPassword!: string;

  @Length(8, 4096)
  newPasswordConfirmation!: string;
}
