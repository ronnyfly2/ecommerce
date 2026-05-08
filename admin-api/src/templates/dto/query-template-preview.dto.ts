import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class QueryTemplatePreviewDto {
  @ApiProperty({ description: 'JWT token for preview access' })
  @IsString()
  @MinLength(10)
  token: string;
}
