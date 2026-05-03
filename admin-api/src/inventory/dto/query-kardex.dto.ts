import { Transform } from 'class-transformer';
import { IsEnum, IsISO8601, IsInt, IsNotEmpty, IsOptional, IsUUID, Min } from 'class-validator';
import { InventoryChannel } from '../enums/inventory-channel.enum';

export class QueryKardexDto {
  @IsNotEmpty()
  @IsUUID()
  productId: string;

  @IsOptional()
  @IsEnum(InventoryChannel)
  channelType?: InventoryChannel;

  @IsOptional()
  @IsUUID()
  storeId?: string;

  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
