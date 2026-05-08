import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { TemplateChannel } from '../enums/template-channel.enum';
import { TemplatePageType } from '../enums/template-page-type.enum';
import { TemplateStatus } from '../enums/template-status.enum';

export class QueryAdminTemplatesDto {
  @ApiPropertyOptional({ example: 'home.main' })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9]+(\.[a-z0-9-]+)+$/)
  templateKey?: string;

  @ApiPropertyOptional({ enum: TemplateChannel })
  @IsOptional()
  @IsEnum(TemplateChannel)
  channel?: TemplateChannel;

  @ApiPropertyOptional({ enum: TemplatePageType })
  @IsOptional()
  @IsEnum(TemplatePageType)
  pageType?: TemplatePageType;

  @ApiPropertyOptional({ enum: TemplateStatus })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @ApiPropertyOptional({ example: 'updatedAt', description: 'createdAt | updatedAt | publishedAt | version' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  sortBy?: 'createdAt' | 'updatedAt' | 'publishedAt' | 'version';

  @ApiPropertyOptional({ example: 'DESC', description: 'ASC | DESC' })
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toUpperCase() : value))
  sortOrder?: 'ASC' | 'DESC';
}
