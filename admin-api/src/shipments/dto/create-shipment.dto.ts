import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateShipmentItemDto {
  @IsUUID()
  orderItemId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateShipmentDto {
  @IsUUID()
  orderId: string;

  @IsOptional()
  @IsUUID()
  carrierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  trackingUrl?: string;

  @IsOptional()
  @IsNumberString()
  shippingCost?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currencyCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shipToName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shipToStreet?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shipToCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shipToState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  shipToPostalCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shipToCountry?: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  shipToPhone?: string;

  @IsOptional()
  @IsLatitude()
  shipToLat?: number;

  @IsOptional()
  @IsLongitude()
  shipToLng?: number;

  @IsOptional()
  @IsISO8601()
  estimatedDeliveryAt?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateShipmentItemDto)
  items: CreateShipmentItemDto[];
}
