import { IsEmail, Length, Matches, MaxLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @MaxLength(128)
  email!: string;

  @Matches(/^[A-Za-z]{2}$/, { message: 'country must be a 2-letter code' })
  country!: string;

  @Length(8, 4096)
  password!: string;

  @Length(8, 4096)
  passwordConfirmation!: string;
}
