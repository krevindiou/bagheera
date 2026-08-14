import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsEmail()
  @MaxLength(128)
  email!: string;

  @IsString()
  @IsNotEmpty()
  currentPassword!: string;
}
