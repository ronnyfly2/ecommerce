import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID } from 'class-validator';

export class CreatePaymentDto {
  @ApiProperty({ description: 'Order id to associate the payment with' })
  @IsUUID()
  orderId: string;

  @ApiProperty({ description: 'Payment method configured by admins' })
  @IsUUID()
  paymentMethodId: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  returnUrl?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  cancelUrl?: string;
}
