import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

const CATEGORY_ATTRIBUTE_TYPES = ['text', 'number', 'boolean', 'select'] as const;

export class CategoryAttributeDefinitionDto {
  @ApiProperty({ example: 'material' })
  @IsString()
  key: string;

  @ApiProperty({ example: 'Material' })
  @IsString()
  label: string;

  @ApiProperty({ enum: CATEGORY_ATTRIBUTE_TYPES, example: 'text' })
  @IsString()
  @IsIn(CATEGORY_ATTRIBUTE_TYPES)
  type: (typeof CATEGORY_ATTRIBUTE_TYPES)[number];

  @ApiPropertyOptional({ example: 'kg' })
  @IsOptional()
  @IsString()
  unit?: string;

  @ApiPropertyOptional({ example: true, default: false })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ type: [String], example: ['Acero', 'Plástico', 'Madera'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @ApiPropertyOptional({ example: 'Dato que verá el equipo al cargar el producto' })
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class CreateCategoryDto {
  @ApiProperty({ example: 'T-Shirts' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: 'Ropa superior casual' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '/uploads/categories/t-shirts.jpg' })
  @IsOptional()
  @IsString()
  image?: string;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 1, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  supportsSizeColorVariants?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  supportsDimensions?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  supportsWeight?: boolean;

  @ApiPropertyOptional({ type: [CategoryAttributeDefinitionDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CategoryAttributeDefinitionDto)
  attributeDefinitions?: CategoryAttributeDefinitionDto[];

  @ApiPropertyOptional({ example: '9ecf76a3-8c9d-4561-b4ad-ef4f54d4ab18' })
  @IsOptional()
  @IsUUID()
  parentId?: string;
}
