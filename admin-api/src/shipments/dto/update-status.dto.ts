import { IsEnum, IsISO8601, IsOptional, IsString } from 'class-validator';
import { ShipmentStatus } from '../enums/shipment-status.enum';

export class UpdateShipmentStatusDto {
  @IsEnum(ShipmentStatus)
  status: ShipmentStatus;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
