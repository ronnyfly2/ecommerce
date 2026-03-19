import { IsString, IsStrongPassword, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @MinLength(1)
  token: string;

  @IsStrongPassword({
    minLength: 8,
    minLowercase: 1,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
  })
  password: string;
}
