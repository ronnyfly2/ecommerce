import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ValidateCouponDto {
  @ApiProperty({ example: 'SUMMER20' })
  @IsString()
  code: string;

  @ApiProperty({ example: 100 })
  orderAmount: number;
}
