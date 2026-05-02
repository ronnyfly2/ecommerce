import {
  IsEnum,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ShipmentEventType } from '../enums/shipment-event-type.enum';
import { ShipmentStatus } from '../enums/shipment-status.enum';

export class AddShipmentEventDto {
  @IsOptional()
  @IsEnum(ShipmentEventType)
  type?: ShipmentEventType;

  @IsOptional()
  @IsEnum(ShipmentStatus)
  status?: ShipmentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  location?: string;

  @IsOptional()
  @IsLatitude()
  lat?: number;

  @IsOptional()
  @IsLongitude()
  lng?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsISO8601()
  occurredAt?: string;
}
