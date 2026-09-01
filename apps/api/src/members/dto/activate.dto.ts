import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class ActivateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(4096)
  key!: string;
}
