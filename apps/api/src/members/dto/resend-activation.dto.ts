import { IsNotEmpty, IsString } from 'class-validator';

export class ResendActivationDto {
  @IsString()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}
