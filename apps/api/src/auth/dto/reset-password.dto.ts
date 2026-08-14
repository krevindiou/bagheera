import { IsNotEmpty, IsString, Length } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  key!: string;

  @Length(8, 4096)
  password!: string;

  @Length(8, 4096)
  passwordConfirmation!: string;
}
