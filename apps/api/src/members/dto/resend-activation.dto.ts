import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ResendActivationDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  password!: string;
}
