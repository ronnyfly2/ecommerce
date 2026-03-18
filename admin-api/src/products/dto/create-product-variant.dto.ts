import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, IsUUID, Min } from 'class-validator';

export class CreateProductVariantDto {
  @ApiProperty({ example: 'SKU-TSHIRT-BLK-M' })
  @IsString()
  sku: string;

  @ApiProperty({ example: '9ecf76a3-8c9d-4561-b4ad-ef4f54d4ab18' })
  @IsUUID()
  sizeId: string;

  @ApiProperty({ example: 'f77222c7-2648-4ef4-8488-350f53e6805b' })
  @IsUUID()
  colorId: string;

  @ApiProperty({ example: 100 })
  @IsNumber()
  @Min(0)
  stock: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  additionalPrice?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
