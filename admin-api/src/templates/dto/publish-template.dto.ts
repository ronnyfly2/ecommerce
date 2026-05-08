import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PublishTemplateDto {
  @ApiPropertyOptional({ example: 'Publicacion de home principal' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  publishNote?: string;
}
