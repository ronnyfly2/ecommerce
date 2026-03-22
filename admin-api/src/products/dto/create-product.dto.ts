import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Max,
  Min,
} from 'class-validator';

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

  @ApiProperty({ example: 29.99 })
  @IsNumber()
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currencyCode?: string;

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

  @ApiPropertyOptional({ example: '9ecf76a3-8c9d-4561-b4ad-ef4f54d4ab18' })
  @IsOptional()
  @IsUUID()
  couponId?: string;

  @ApiPropertyOptional({ example: 'https://shop.example.com/cupones/summer20' })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  couponLink?: string;
}
