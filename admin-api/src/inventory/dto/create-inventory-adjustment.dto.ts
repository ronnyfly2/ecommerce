import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { InventoryMovementType } from '../enums/inventory-movement-type.enum';

export class CreateInventoryAdjustmentDto {
  @ApiProperty({ example: 'f77222c7-2648-4ef4-8488-350f53e6805b' })
  @IsString()
  variantId: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  quantityChange: number;

  @ApiProperty({ enum: InventoryMovementType, example: InventoryMovementType.ADJUSTMENT })
  @IsEnum(InventoryMovementType)
  type: InventoryMovementType;

  @ApiPropertyOptional({ example: 'Stock correction' })
  @IsOptional()
  @IsString()
  reason?: string;
}
