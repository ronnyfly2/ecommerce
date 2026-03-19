import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, IsUrl, Min } from 'class-validator';

export class CreateProductImageDto {
  @ApiProperty({
    example: 'http://localhost:3000/uploads/1742299999999-123456789.jpg',
  })
  @IsString()
  @IsUrl({ require_tld: false })
  url: string;

  @ApiPropertyOptional({ example: 'Frente del producto' })
  @IsOptional()
  @IsString()
  altText?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isMain?: boolean;
}
