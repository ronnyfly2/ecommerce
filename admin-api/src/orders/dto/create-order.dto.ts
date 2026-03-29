import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
  IsNumber,
  IsOptional,
  Min,
  IsEnum,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderFulfillmentType } from '../enums/order-fulfillment-type.enum';

export class ShippingAddressDto {
  @ApiProperty({ example: 'John' })
  @IsString()
  firstName: string;

  @ApiProperty({ example: 'Doe' })
  @IsString()
  lastName: string;

  @ApiProperty({ example: '123 Main St' })
  @IsString()
  street: string;

  @ApiProperty({ example: 'New York' })
  @IsString()
  city: string;

  @ApiProperty({ example: 'NY' })
  @IsString()
  state: string;

  @ApiProperty({ example: '10001' })
  @IsString()
  postalCode: string;

  @ApiProperty({ example: 'US' })
  @IsString()
  country: string;

  @ApiPropertyOptional({ example: '5551234567' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;
}

export class CreateOrderItemDto {
  @ApiPropertyOptional({ example: 'f77222c7-2648-4ef4-8488-350f53e6805b' })
  @IsOptional()
  @IsUUID()
  productId?: string;

  @ApiPropertyOptional({ example: 'f77222c7-2648-4ef4-8488-350f53e6805b' })
  @IsOptional()
  @IsUUID()
  variantId?: string;

  @ApiProperty({ example: 2 })
  @IsNumber()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ApiProperty({ type: [CreateOrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @ApiPropertyOptional({ example: 'SUMMER20' })
  @IsOptional()
  @IsString()
  couponCode?: string;

  @ApiPropertyOptional({ example: 'USD', default: 'USD' })
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional({ example: 'Please leave at door' })
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ enum: OrderFulfillmentType, example: OrderFulfillmentType.DELIVERY })
  @IsOptional()
  @IsEnum(OrderFulfillmentType)
  fulfillmentType?: OrderFulfillmentType;

  @ApiPropertyOptional({ example: 'f77222c7-2648-4ef4-8488-350f53e6805b' })
  @ValidateIf((dto: CreateOrderDto) => dto.fulfillmentType === OrderFulfillmentType.PICKUP)
  @IsUUID()
  pickupStoreId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => ShippingAddressDto)
  shippingAddress?: ShippingAddressDto;
}
