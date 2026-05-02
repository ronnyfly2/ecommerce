import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProviderType } from '../enums/payment-provider-type.enum';
import {
  CreatePaymentInput,
  CreatePaymentResult,
  PaymentProvider,
  RefundInput,
  RefundResult,
  WebhookEventInput,
  WebhookEventResult,
} from './payment-provider.interface';

/**
 * Skeleton Stripe-compatible hosted checkout provider.
 * The actual Stripe SDK call is deferred — this implementation returns a
 * placeholder checkout URL so the flow can be exercised end-to-end while the
 * production API keys are not yet configured.
 */
@Injectable()
export class StripeProvider implements PaymentProvider {
  readonly type = PaymentProviderType.STRIPE;

  private readonly logger = new Logger(StripeProvider.name);

  constructor(private readonly configService: ConfigService) {}

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult> {
    const apiKey = this.getSecret(input.method.config);
    if (!apiKey) {
      this.logger.warn(
        `Stripe method ${input.method.code} has no api key configured; returning stub checkout url.`,
      );
    }

    const externalId = `cs_stub_${input.payment.id}`;
    const checkoutUrl =
      this.buildStubCheckoutUrl(input) ||
      `https://checkout.stripe.com/pay/${externalId}`;

    return {
      externalId,
      checkoutUrl,
      metadata: {
        stubbed: !apiKey,
      },
    };
  }

  async handleWebhook(input: WebhookEventInput): Promise<WebhookEventResult | null> {
    try {
      const payload =
        typeof input.rawBody === 'string'
          ? JSON.parse(input.rawBody)
          : JSON.parse(input.rawBody.toString('utf8'));
      const externalId =
        payload?.data?.object?.id ?? payload?.data?.object?.payment_intent ?? null;
      const type = String(payload?.type ?? '');
      if (!externalId) return null;

      if (type === 'checkout.session.completed' || type === 'payment_intent.succeeded') {
        return { externalId, status: 'approved', metadata: { type } };
      }
      if (type === 'payment_intent.payment_failed') {
        return { externalId, status: 'failed', metadata: { type } };
      }
      if (type === 'charge.refunded') {
        return { externalId, status: 'refunded', metadata: { type } };
      }
      return null;
    } catch (error) {
      this.logger.warn(`Failed to parse stripe webhook: ${(error as Error).message}`);
      return null;
    }
  }

  async refund(input: RefundInput): Promise<RefundResult> {
    this.logger.log(
      `Stripe refund requested for payment ${input.payment.id} amount=${input.amount ?? 'full'}`,
    );
    return {
      externalId: input.payment.externalId ?? undefined,
      metadata: { refundStub: true, reason: input.reason ?? null },
    };
  }

  private getSecret(config: Record<string, unknown>): string | null {
    const configured = typeof config?.secretKey === 'string' ? config.secretKey : null;
    return configured || this.configService.get<string>('STRIPE_SECRET_KEY') || null;
  }

  private buildStubCheckoutUrl(input: CreatePaymentInput): string | null {
    const appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:5173';
    const query = new URLSearchParams({
      amount: input.payment.amount,
      currency: input.payment.currencyCode,
      paymentId: input.payment.id,
    });
    return `${appUrl}/checkout/stub?${query.toString()}`;
  }
}
