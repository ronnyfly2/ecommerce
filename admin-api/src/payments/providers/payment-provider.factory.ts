import { BadRequestException, Injectable } from '@nestjs/common';
import { PaymentProviderType } from '../enums/payment-provider-type.enum';
import { ManualTransferProvider } from './manual-transfer.provider';
import { StripeProvider } from './stripe.provider';
import { CashOnDeliveryProvider } from './cash-on-delivery.provider';
import { PaymentProvider } from './payment-provider.interface';

@Injectable()
export class PaymentProviderFactory {
  private readonly registry: Map<PaymentProviderType, PaymentProvider>;

  constructor(
    manual: ManualTransferProvider,
    stripe: StripeProvider,
    cod: CashOnDeliveryProvider,
  ) {
    this.registry = new Map<PaymentProviderType, PaymentProvider>([
      [manual.type, manual],
      [stripe.type, stripe],
      [cod.type, cod],
    ]);
  }

  get(provider: PaymentProviderType): PaymentProvider {
    const impl = this.registry.get(provider);
    if (!impl) {
      throw new BadRequestException(`Unsupported payment provider: ${provider}`);
    }
    return impl;
  }
}
