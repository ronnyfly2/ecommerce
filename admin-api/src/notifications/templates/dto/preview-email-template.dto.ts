import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class PreviewEmailTemplateDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @IsOptional()
  @IsString()
  html?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}
