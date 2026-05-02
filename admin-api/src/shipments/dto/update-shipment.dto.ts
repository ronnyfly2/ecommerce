import {
  IsISO8601,
  IsLatitude,
  IsLongitude,
  IsNumberString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class UpdateShipmentDto {
  @IsOptional()
  @IsUUID()
  carrierId?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  trackingNumber?: string | null;

  @IsOptional()
  @IsString()
  trackingUrl?: string | null;

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
  shipToName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  shipToStreet?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shipToCity?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shipToState?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  shipToPostalCode?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  shipToCountry?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  shipToPhone?: string | null;

  @IsOptional()
  @IsLatitude()
  shipToLat?: number | null;

  @IsOptional()
  @IsLongitude()
  shipToLng?: number | null;

  @IsOptional()
  @IsISO8601()
  estimatedDeliveryAt?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
