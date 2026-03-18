import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsString, Min } from 'class-validator';

export class CreateSizeDto {
  @ApiProperty({ example: 'Medium' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'M' })
  @IsString()
  abbreviation: string;

  @ApiPropertyOptional({ example: 3, default: 0 })
  @IsInt()
  @Min(0)
  displayOrder: number = 0;
}
