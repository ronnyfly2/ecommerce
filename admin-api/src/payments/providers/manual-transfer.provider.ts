import { Injectable } from '@nestjs/common';
import { PaymentProviderType } from '../enums/payment-provider-type.enum';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
} from './payment-provider.interface';

@Injectable()
export class ManualTransferProvider implements PaymentProvider {
  readonly type = PaymentProviderType.MANUAL_TRANSFER;

  async createPayment(_input: CreatePaymentInput): Promise<CreatePaymentResult> {
    return {
      checkoutUrl: null,
      waitingForReceipt: true,
      metadata: {
        instructionsDisplayed: true,
      },
    };
  }
}
