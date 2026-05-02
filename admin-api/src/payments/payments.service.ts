import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { Order } from '../orders/entities/order.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { User } from '../users/entities/user.entity';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { QueryPaymentsDto } from './dto/query-payments.dto';
import { ReviewPaymentDto } from './dto/review-payment.dto';
import { UpsertPaymentMethodDto } from './dto/upsert-payment-method.dto';
import { Payment } from './entities/payment.entity';
import { PaymentMethod } from './entities/payment-method.entity';
import { PaymentStatus } from './enums/payment-status.enum';
import { PaymentProviderType } from './enums/payment-provider-type.enum';
import { PaymentProviderFactory } from './providers/payment-provider.factory';

interface ActorUser {
  id: string;
  role: Role;
}

interface UploadedReceiptFile {
  filename: string;
  mimetype: string;
  size: number;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(PaymentMethod)
    private readonly methodsRepository: Repository<PaymentMethod>,
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    private readonly providerFactory: PaymentProviderFactory,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  // ===== Customer flow =====

  async create(dto: CreatePaymentDto, actor: ActorUser): Promise<Payment> {
    const order = await this.ordersRepository.findOne({
      where: { id: dto.orderId },
      relations: { user: true },
    });
    if (!order) throw new NotFoundException('Order not found');
    this.assertOrderAccess(order, actor);

    const method = await this.methodsRepository.findOne({
      where: { id: dto.paymentMethodId, isEnabled: true },
    });
    if (!method) throw new NotFoundException('Payment method not found or disabled');

    const existing = await this.paymentsRepository.findOne({
      where: {
        order: { id: order.id },
        status: PaymentStatus.APPROVED,
      },
      relations: { order: true },
    });
    if (existing) {
      throw new BadRequestException('This order already has an approved payment');
    }

    const payment = this.paymentsRepository.create({
      order,
      method,
      provider: method.provider,
      status: PaymentStatus.PENDING,
      amount: order.total,
      currencyCode: order.currencyCode,
      metadata: {},
    });
    const saved = await this.paymentsRepository.save(payment);

    const provider = this.providerFactory.get(method.provider);
    const result = await provider.createPayment({
      payment: saved,
      method,
      returnUrl: dto.returnUrl,
      cancelUrl: dto.cancelUrl,
    });

    saved.externalId = result.externalId ?? null;
    saved.checkoutUrl = result.checkoutUrl ?? null;
    saved.metadata = { ...saved.metadata, ...(result.metadata ?? {}) };

    if (result.autoApprove) {
      saved.status = PaymentStatus.APPROVED;
      saved.reviewedAt = new Date();
    } else if (result.waitingForReceipt) {
      saved.status = PaymentStatus.PENDING;
    }

    return this.paymentsRepository.save(saved);
  }

  async uploadReceipt(
    id: string,
    file: UploadedReceiptFile,
    actor: ActorUser,
  ): Promise<Payment> {
    const payment = await this.findOneOrThrow(id);
    this.assertOrderAccess(payment.order, actor);

    if (payment.provider !== PaymentProviderType.MANUAL_TRANSFER) {
      throw new BadRequestException('Receipts can only be uploaded for manual transfers');
    }
    if (
      payment.status !== PaymentStatus.PENDING &&
      payment.status !== PaymentStatus.AWAITING_REVIEW &&
      payment.status !== PaymentStatus.REJECTED
    ) {
      throw new BadRequestException(
        `Receipt cannot be uploaded when payment is ${payment.status}`,
      );
    }

    payment.receiptFilename = file.filename;
    payment.receiptMime = file.mimetype;
    payment.receiptSize = file.size;
    payment.receiptUrl = `/uploads/${file.filename}`;
    payment.receiptUploadedAt = new Date();
    payment.status = PaymentStatus.AWAITING_REVIEW;
    payment.rejectionReason = null;

    const saved = await this.paymentsRepository.save(payment);

    await this.notifyReceiptReceived(saved).catch((error) => {
      this.logger.warn(
        `Receipt received email failed for payment ${saved.id}: ${(error as Error).message}`,
      );
    });

    return saved;
  }

  async cancel(id: string, actor: ActorUser): Promise<Payment> {
    const payment = await this.findOneOrThrow(id);
    this.assertOrderAccess(payment.order, actor);
    if (
      payment.status === PaymentStatus.APPROVED ||
      payment.status === PaymentStatus.REFUNDED
    ) {
      throw new BadRequestException('Cannot cancel an approved or refunded payment');
    }
    payment.status = PaymentStatus.CANCELLED;
    return this.paymentsRepository.save(payment);
  }

  // ===== Admin flow =====

  async findAll(query: QueryPaymentsDto, actor: ActorUser) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Payment> = {};
    if (query.status) where.status = query.status;
    if (query.provider) where.provider = query.provider;
    if (query.orderId) where.order = { id: query.orderId } as Order;

    if (!this.isBackofficeRole(actor.role)) {
      where.order = { ...(where.order as object), user: { id: actor.id } } as Order;
    }

    const [items, total] = await this.paymentsRepository.findAndCount({
      where,
      relations: { order: { user: true }, method: true, reviewedBy: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, actor: ActorUser): Promise<Payment> {
    const payment = await this.findOneOrThrow(id);
    this.assertOrderAccess(payment.order, actor);
    return payment;
  }

  async review(id: string, dto: ReviewPaymentDto, reviewerId: string): Promise<Payment> {
    const payment = await this.findOneOrThrow(id);

    if (payment.status !== PaymentStatus.AWAITING_REVIEW) {
      throw new BadRequestException(
        `Only payments in AWAITING_REVIEW can be reviewed (current: ${payment.status})`,
      );
    }

    if (dto.decision === 'reject' && !dto.reason) {
      throw new BadRequestException('A reason is required when rejecting a payment');
    }

    if (dto.decision === 'approve') {
      payment.status = PaymentStatus.APPROVED;
      payment.rejectionReason = null;
    } else {
      payment.status = PaymentStatus.REJECTED;
      payment.rejectionReason = dto.reason ?? null;
    }
    payment.reviewedBy = { id: reviewerId } as User;
    payment.reviewedAt = new Date();
    const saved = await this.paymentsRepository.save(payment);

    await this.notifyDecision(saved).catch((error) => {
      this.logger.warn(
        `Payment decision email failed for ${saved.id}: ${(error as Error).message}`,
      );
    });

    return saved;
  }

  async refund(id: string, reviewerId: string, reason?: string): Promise<Payment> {
    const payment = await this.findOneOrThrow(id);
    if (payment.status !== PaymentStatus.APPROVED) {
      throw new BadRequestException('Only approved payments can be refunded');
    }
    const provider = this.providerFactory.get(payment.provider);
    if (provider.refund) {
      const result = await provider.refund({
        payment,
        reason,
      });
      payment.metadata = { ...payment.metadata, ...(result.metadata ?? {}) };
    }
    payment.status = PaymentStatus.REFUNDED;
    payment.reviewedBy = { id: reviewerId } as User;
    payment.reviewedAt = new Date();
    payment.rejectionReason = reason ?? null;
    return this.paymentsRepository.save(payment);
  }

  // ===== Webhooks =====

  async handleWebhook(
    providerCode: string,
    rawBody: Buffer,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<{ received: boolean }> {
    const method = await this.methodsRepository.findOne({ where: { code: providerCode } });
    if (!method) throw new NotFoundException('Unknown payment method for webhook');

    const provider = this.providerFactory.get(method.provider);
    if (!provider.handleWebhook) {
      return { received: true };
    }

    const event = await provider.handleWebhook({ rawBody, headers, method });
    if (!event) return { received: true };

    const payment = await this.paymentsRepository.findOne({
      where: { externalId: event.externalId },
      relations: { order: { user: true }, method: true },
    });
    if (!payment) {
      this.logger.warn(`Webhook received for unknown external id ${event.externalId}`);
      return { received: true };
    }

    const statusMap: Record<string, PaymentStatus> = {
      approved: PaymentStatus.APPROVED,
      rejected: PaymentStatus.REJECTED,
      failed: PaymentStatus.FAILED,
      refunded: PaymentStatus.REFUNDED,
      pending: PaymentStatus.PENDING,
    };
    const nextStatus = statusMap[event.status];
    if (nextStatus && payment.status !== nextStatus) {
      payment.status = nextStatus;
      payment.metadata = { ...payment.metadata, webhook: event.metadata ?? null };
      if (nextStatus === PaymentStatus.APPROVED || nextStatus === PaymentStatus.REJECTED) {
        payment.reviewedAt = new Date();
      }
      const saved = await this.paymentsRepository.save(payment);
      await this.notifyDecision(saved).catch((error) => {
        this.logger.warn(
          `Webhook decision email failed for ${saved.id}: ${(error as Error).message}`,
        );
      });
    }

    return { received: true };
  }

  // ===== Payment methods CRUD (admin) =====

  listMethods(onlyEnabled = false): Promise<PaymentMethod[]> {
    return this.methodsRepository.find({
      where: onlyEnabled ? { isEnabled: true } : {},
      order: { displayOrder: 'ASC', label: 'ASC' },
    });
  }

  async getMethod(id: string): Promise<PaymentMethod> {
    const method = await this.methodsRepository.findOne({ where: { id } });
    if (!method) throw new NotFoundException('Payment method not found');
    return method;
  }

  async createMethod(dto: UpsertPaymentMethodDto): Promise<PaymentMethod> {
    const existing = await this.methodsRepository.findOne({ where: { code: dto.code } });
    if (existing) throw new BadRequestException(`Code "${dto.code}" already exists`);
    const method = this.methodsRepository.create({
      code: dto.code,
      label: dto.label,
      description: dto.description ?? null,
      provider: dto.provider,
      type: dto.type,
      isEnabled: dto.isEnabled ?? true,
      displayOrder: dto.displayOrder ?? 0,
      instructions: dto.instructions ?? null,
      config: dto.config ?? {},
    });
    return this.methodsRepository.save(method);
  }

  async updateMethod(id: string, dto: UpsertPaymentMethodDto): Promise<PaymentMethod> {
    const method = await this.getMethod(id);
    if (dto.code && dto.code !== method.code) {
      const clash = await this.methodsRepository.findOne({ where: { code: dto.code } });
      if (clash) throw new BadRequestException(`Code "${dto.code}" already exists`);
      method.code = dto.code;
    }
    method.label = dto.label;
    method.description = dto.description ?? null;
    method.provider = dto.provider;
    method.type = dto.type;
    method.isEnabled = dto.isEnabled ?? method.isEnabled;
    method.displayOrder = dto.displayOrder ?? method.displayOrder;
    method.instructions = dto.instructions ?? null;
    method.config = dto.config ?? {};
    return this.methodsRepository.save(method);
  }

  async deleteMethod(id: string): Promise<void> {
    const method = await this.getMethod(id);
    const inUse = await this.paymentsRepository.count({
      where: { method: { id: method.id } },
    });
    if (inUse > 0) {
      throw new BadRequestException('Cannot delete a payment method with existing payments');
    }
    await this.methodsRepository.remove(method);
  }

  // ===== Helpers =====

  private async findOneOrThrow(id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({
      where: { id },
      relations: { order: { user: true }, method: true, reviewedBy: true },
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  private assertOrderAccess(order: Order, actor: ActorUser): void {
    if (this.isBackofficeRole(actor.role)) return;
    if (order.user?.id !== actor.id) {
      throw new ForbiddenException('You do not have access to this payment');
    }
  }

  private isBackofficeRole(role: Role): boolean {
    return [
      Role.SUPER_ADMIN,
      Role.ADMIN,
      Role.BOSS,
      Role.MARKETING,
      Role.SALES,
    ].includes(role);
  }

  private async notifyReceiptReceived(payment: Payment): Promise<void> {
    if (!payment.order?.user?.email) return;
    await this.notificationsService.sendPaymentReceiptReceived(payment);
  }

  private async notifyDecision(payment: Payment): Promise<void> {
    if (!payment.order?.user?.email) return;
    if (payment.status === PaymentStatus.APPROVED) {
      await this.notificationsService.sendPaymentApproved(payment);
    } else if (payment.status === PaymentStatus.REJECTED) {
      await this.notificationsService.sendPaymentRejected(payment);
    }
  }
}
