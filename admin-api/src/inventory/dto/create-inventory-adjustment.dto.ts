import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Min } from 'class-validator';
import { InventoryMovementType } from '../enums/inventory-movement-type.enum';
import { InventoryChannel } from '../enums/inventory-channel.enum';

export class CreateInventoryAdjustmentDto {
  @ApiPropertyOptional({ example: 'f77222c7-2648-4ef4-8488-350f53e6805b' })
  @IsString()
  @IsOptional()
  productId?: string;

  @ApiPropertyOptional({ example: 'f77222c7-2648-4ef4-8488-350f53e6805b' })
  @IsOptional()
  @IsString()
  variantId?: string;

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

  @ApiPropertyOptional({ enum: InventoryChannel, example: InventoryChannel.DELIVERY })
  @IsOptional()
  @IsEnum(InventoryChannel)
  channelType?: InventoryChannel;

  @ApiPropertyOptional({ example: 'f77222c7-2648-4ef4-8488-350f53e6805b' })
  @IsOptional()
  @IsUUID()
  storeId?: string;
}
