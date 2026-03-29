import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PickupStoreStockDto {
  @ApiProperty({ example: 'f77222c7-2648-4ef4-8488-350f53e6805b' })
  @IsUUID()
  storeId: string;

  @ApiProperty({ example: 10 })
  @IsInt()
  @Min(0)
  stock: number;
}

export class UpsertProductStockDto {
  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @IsInt()
  @Min(0)
  deliveryStock?: number;

  @ApiPropertyOptional({ type: [PickupStoreStockDto] })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PickupStoreStockDto)
  pickupStocks?: PickupStoreStockDto[];
}
