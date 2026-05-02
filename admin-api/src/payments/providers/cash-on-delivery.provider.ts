import { Injectable } from '@nestjs/common';
import { PaymentProviderType } from '../enums/payment-provider-type.enum';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.interface';

@Injectable()
export class CashOnDeliveryProvider implements PaymentProvider {
  readonly type = PaymentProviderType.CASH_ON_DELIVERY;

  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      checkoutUrl: null,
      metadata: { collectOnDelivery: true },
    };
  }
}
