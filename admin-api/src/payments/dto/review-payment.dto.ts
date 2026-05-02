import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class ReviewPaymentDto {
  @ApiProperty({ enum: ['approve', 'reject'] })
  @IsIn(['approve', 'reject'])
  decision: 'approve' | 'reject';

  @ApiProperty({ required: false, description: 'Required when decision is "reject"' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
