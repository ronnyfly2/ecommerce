import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsHexColor, IsOptional, IsString } from 'class-validator';

export class CreateColorDto {
  @ApiProperty({ example: 'Black' })
  @IsString()
  name: string;

  @ApiProperty({ example: '#000000' })
  @IsHexColor()
  hexCode: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
