import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const WEIGHT_UNITS = ['mcg', 'mg', 'g', 'kg', 'lb', 'oz', 'st', 't'] as const;
const DIMENSION_UNITS = ['mm', 'cm', 'm', 'km', 'in', 'ft', 'yd', 'mi'] as const;

export class ProductAttributeValueDto {
  @ApiProperty({ example: 'material' })
  @IsString()
  key: string;

  @ApiPropertyOptional({ example: 'Acero inoxidable' })
  @IsOptional()
  value?: string | number | boolean | null;
}

export class CreateProductDto {
  @ApiProperty({ example: 'Classic T-Shirt' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'REMERA-OVERSIZE-NEGRA' })
  @IsString()
  sku: string;

  @ApiPropertyOptional({ example: 'Remera de algodón premium' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'Clean silhouette with contrast seam lines and oversized fit.' })
  @IsOptional()
  @IsString()
  graphicDescription?: string;

  @ApiPropertyOptional({ example: 'Wear with neutral bottoms and wash at low temperature.' })
  @IsOptional()
  @IsString()
  usageMode?: string;

  @ApiProperty({ example: 29.99 })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional({ example: 12, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional({ example: 1.25 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  weightValue?: number;

  @ApiPropertyOptional({ example: 'kg', enum: WEIGHT_UNITS })
  @IsOptional()
  @IsString()
  @IsIn(WEIGHT_UNITS)
  weightUnit?: string;

  @ApiPropertyOptional({ example: 35 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lengthValue?: number;

  @ApiPropertyOptional({ example: 22 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  widthValue?: number;

  @ApiPropertyOptional({ example: 10 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  heightValue?: number;

  @ApiPropertyOptional({ example: 'cm', enum: DIMENSION_UNITS })
  @IsOptional()
  @IsString()
  @IsIn(DIMENSION_UNITS)
  dimensionUnit?: string;

  @ApiProperty({ example: '9ecf76a3-8c9d-4561-b4ad-ef4f54d4ab18' })
  @IsUUID()
  categoryId: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isFeatured?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  hasOffer?: boolean;

  @ApiPropertyOptional({ example: 24.99 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  offerPrice?: number;

  @ApiPropertyOptional({ example: 15 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  offerPercentage?: number;

  @ApiPropertyOptional({ type: [String], example: ['9ecf76a3-8c9d-4561-b4ad-ef4f54d4ab18'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tagIds?: string[];

  @ApiPropertyOptional({ type: [String], example: ['9ecf76a3-8c9d-4561-b4ad-ef4f54d4ab18'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  relatedProductIds?: string[];

  @ApiPropertyOptional({ type: [String], example: ['9ecf76a3-8c9d-4561-b4ad-ef4f54d4ab18'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  suggestedProductIds?: string[];

  @ApiPropertyOptional({ type: [String], example: ['9ecf76a3-8c9d-4561-b4ad-ef4f54d4ab18'] })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  variantProductIds?: string[];

  @ApiPropertyOptional({ type: [ProductAttributeValueDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductAttributeValueDto)
  attributeValues?: ProductAttributeValueDto[];

  @ApiPropertyOptional({ example: '9ecf76a3-8c9d-4561-b4ad-ef4f54d4ab18' })
  @IsOptional()
  @IsUUID()
  couponId?: string;

  @ApiPropertyOptional({ example: 'https://shop.example.com/cupones/summer20' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  couponLink?: string;
}
