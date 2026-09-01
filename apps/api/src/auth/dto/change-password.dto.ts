import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  currentPassword!: string;

  @Length(8, 4096)
  newPassword!: string;

  @Length(8, 4096)
  newPasswordConfirmation!: string;
}
