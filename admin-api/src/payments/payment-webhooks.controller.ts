import {
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@ApiExcludeController()
@Public()
@Controller('payment-webhooks')
export class PaymentWebhooksController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post(':methodCode')
  @HttpCode(HttpStatus.OK)
  async handle(
    @Param('methodCode') methodCode: string,
    @Req() req: Request,
    @Headers() headers: Record<string, string | string[] | undefined>,
  ) {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from(
      JSON.stringify(req.body ?? {}),
    );
    return this.paymentsService.handleWebhook(methodCode, rawBody, headers);
  }
}
