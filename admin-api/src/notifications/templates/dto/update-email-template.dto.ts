import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateEmailTemplateDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  subject: string;

  @IsString()
  @MinLength(1)
  html: string;

  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;
}
