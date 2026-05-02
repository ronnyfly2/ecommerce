import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class ReceiveReturnItemDto {
  @ApiProperty()
  @IsUUID()
  returnItemId: string;

  @ApiProperty({ minimum: 0 })
  @IsInt()
  @Min(0)
  receivedQuantity: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  restockable?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  conditionNotes?: string;
}

export class ReceiveReturnDto {
  @ApiProperty({ type: [ReceiveReturnItemDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ReceiveReturnItemDto)
  items: ReceiveReturnItemDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  internalNotes?: string;
}
