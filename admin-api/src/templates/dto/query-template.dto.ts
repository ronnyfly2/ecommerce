import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { TemplateChannel } from '../enums/template-channel.enum';

export class QueryTemplateDto {
  @ApiPropertyOptional({ enum: TemplateChannel, default: TemplateChannel.WEB })
  @IsOptional()
  @IsEnum(TemplateChannel)
  channel?: TemplateChannel = TemplateChannel.WEB;

  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @Transform(({ value }) => (value === undefined ? undefined : Number(value)))
  @IsInt()
  @Min(1)
  version?: number;
}
