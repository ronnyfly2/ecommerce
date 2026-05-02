import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNumberString,
  IsOptional,
  IsString,
} from 'class-validator';
import { RefundMethod } from '../enums/refund-method.enum';

export class RefundReturnDto {
  @ApiProperty({ description: 'Decimal string, e.g. "45.90"' })
  @IsNumberString()
  refundAmount: string;

  @ApiProperty({ enum: RefundMethod })
  @IsEnum(RefundMethod)
  refundMethod: RefundMethod;

  @ApiPropertyOptional({ description: 'External reference (e.g. transfer id, gateway refund id)' })
  @IsOptional()
  @IsString()
  refundReference?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  currencyCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;
}
