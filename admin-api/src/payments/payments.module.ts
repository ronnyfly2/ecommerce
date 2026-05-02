import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Payment } from './entities/payment.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentsService } from './payments.service';
import { PaymentsController } from './payments.controller';
import { PaymentMethodsController } from './payment-methods.controller';
import { PaymentWebhooksController } from './payment-webhooks.controller';
import { ManualTransferProvider } from './providers/manual-transfer.provider';
import { StripeProvider } from './providers/stripe.provider';
import { CashOnDeliveryProvider } from './providers/cash-on-delivery.provider';
import { PaymentProviderFactory } from './providers/payment-provider.factory';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, PaymentMethod, Order]),
    NotificationsModule,
  ],
  controllers: [
    PaymentsController,
    PaymentMethodsController,
    PaymentWebhooksController,
  ],
  providers: [
    PaymentsService,
    ManualTransferProvider,
    StripeProvider,
    CashOnDeliveryProvider,
    PaymentProviderFactory,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
