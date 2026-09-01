import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResendActivationDto {
  @IsEmail()
  @MaxLength(128)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  password!: string;
}
