import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaymentMethodType } from '../enums/payment-method-type.enum';
import { PaymentProviderType } from '../enums/payment-provider-type.enum';

export class UpsertPaymentMethodDto {
  @ApiProperty({ description: 'Unique machine code, e.g. "bank-main", "stripe-usd"' })
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  @Matches(/^[a-z0-9][a-z0-9-_]*$/i, {
    message: 'code must be alphanumeric with dashes/underscores',
  })
  code: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  label: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: PaymentProviderType })
  @IsEnum(PaymentProviderType)
  provider: PaymentProviderType;

  @ApiProperty({ enum: PaymentMethodType })
  @IsEnum(PaymentMethodType)
  type: PaymentMethodType;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isEnabled?: boolean;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  instructions?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
