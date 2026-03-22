import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCurrencyDto {
  @ApiProperty({ example: 'USD' })
  @IsString()
  @MaxLength(3)
  code: string;

  @ApiProperty({ example: 'US Dollar' })
  @IsString()
  @MaxLength(60)
  name: string;

  @ApiProperty({ example: '$' })
  @IsString()
  @MaxLength(10)
  symbol: string;

  @ApiProperty({ example: 1 })
  @IsNumber()
  @Min(0.000001)
  exchangeRateToUsd: number;

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
