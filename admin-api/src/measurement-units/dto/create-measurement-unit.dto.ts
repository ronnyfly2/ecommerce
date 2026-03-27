import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { MEASUREMENT_UNIT_FAMILIES } from '../entities/measurement-unit.entity';

export class CreateMeasurementUnitDto {
  @ApiProperty({ example: 'kg' })
  @IsString()
  @MaxLength(30)
  code: string;

  @ApiProperty({ example: 'Kilogramos' })
  @IsString()
  @MaxLength(120)
  label: string;

  @ApiProperty({ example: 'weight', enum: MEASUREMENT_UNIT_FAMILIES })
  @IsString()
  @IsIn(MEASUREMENT_UNIT_FAMILIES)
  family: (typeof MEASUREMENT_UNIT_FAMILIES)[number];

  @ApiPropertyOptional({ example: true, default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: 0, default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  displayOrder?: number;
}