import { IsNotEmpty, IsString, Length, MaxLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  key!: string;

  @Length(8, 4096)
  password!: string;

  @Length(8, 4096)
  passwordConfirmation!: string;
}
