import { Payment } from '../entities/payment.entity';
import { PaymentMethod } from '../entities/payment-method.entity';
import { PaymentProviderType } from '../enums/payment-provider-type.enum';

export interface CreatePaymentInput {
  payment: Payment;
  method: PaymentMethod;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface CreatePaymentResult {
  checkoutUrl?: string | null;
  externalId?: string | null;
  metadata?: Record<string, unknown>;
  /** When true, payment is considered already approved (e.g. COD flows). */
  autoApprove?: boolean;
  /** When true, payment remains PENDING waiting for customer action. */
  waitingForReceipt?: boolean;
}

export interface WebhookEventInput {
  rawBody: Buffer | string;
  headers: Record<string, string | string[] | undefined>;
  method: PaymentMethod;
}

export interface WebhookEventResult {
  externalId: string;
  status: 'approved' | 'rejected' | 'refunded' | 'failed' | 'pending';
  metadata?: Record<string, unknown>;
}

export interface RefundInput {
  payment: Payment;
  amount?: number;
  reason?: string;
}

export interface RefundResult {
  externalId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentProvider {
  readonly type: PaymentProviderType;

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>;

  handleWebhook?(input: WebhookEventInput): Promise<WebhookEventResult | null>;

  refund?(input: RefundInput): Promise<RefundResult>;
}
