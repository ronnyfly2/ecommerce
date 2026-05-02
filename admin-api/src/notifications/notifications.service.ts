import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { User } from '../users/entities/user.entity';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationType } from './enums/notification-type.enum';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { EmailTemplateKey } from './templates/enums/template-key.enum';
import { MailService } from './templates/mail.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly mailService: MailService,
    private readonly configService: ConfigService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async notifyUserRegistered(user: User): Promise<void> {
    const customerName = this.getUserDisplayName(user);

    await this.notifyAdmins({
      type: NotificationType.USER_REGISTERED,
      actorUserId: user.id,
      title: 'Nuevo usuario registrado',
      message: `${customerName} se registro con el email ${user.email}.`,
      link: '/users',
      metadata: {
        userId: user.id,
      },
    });
  }

  async notifyOrderCreated(order: Order): Promise<void> {
    const customerName = this.getUserDisplayName(order.user);
    const orderCode = order.id.slice(0, 8).toUpperCase();

    await this.notifyAdmins({
      type: NotificationType.ORDER_CREATED,
      actorUserId: order.user.id,
      title: 'Nueva compra registrada',
      message: `${customerName} genero la orden #${orderCode} por ${this.formatCurrency(order.total, order.currencyCode)}.`,
      link: `/orders/${order.id}`,
      metadata: {
        orderId: order.id,
        status: order.status,
      },
    });
  }

  async notifyOrderStatusChanged(
    order: Order,
    previousStatus: OrderStatus,
    actorUserId?: string,
  ): Promise<void> {
    if (previousStatus === order.status) {
      return;
    }

    const orderCode = order.id.slice(0, 8).toUpperCase();

    await this.notifyAdmins({
      type: NotificationType.ORDER_STATUS_CHANGED,
      actorUserId: actorUserId ?? order.user.id,
      title: 'Cambio de estado de orden',
      message: `La orden #${orderCode} cambio de ${previousStatus} a ${order.status}.`,
      link: `/orders/${order.id}`,
      metadata: {
        orderId: order.id,
        previousStatus,
        status: order.status,
      },
    });
  }

  async findForUser(userId: string, query: QueryNotificationsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 50);
    const unreadOnly = query.unreadOnly === true;

    const notificationsQuery = this.notificationsRepository
      .createQueryBuilder('notification')
      .leftJoinAndSelect('notification.actorUser', 'actor')
      .where('notification.recipient_user_id = :userId', { userId });

    if (unreadOnly) {
      notificationsQuery.andWhere('notification.is_read = false');
    }

    if (query.type) {
      notificationsQuery.andWhere('notification.type = :type', { type: query.type });
    }

    notificationsQuery
      .select([
        'notification.id',
        'notification.type',
        'notification.title',
        'notification.message',
        'notification.link',
        'notification.metadata',
        'notification.isRead',
        'notification.readAt',
        'notification.createdAt',
        'actor.id',
        'actor.email',
        'actor.firstName',
        'actor.lastName',
        'actor.role',
        'actor.avatar',
      ])
      .orderBy('notification.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await notificationsQuery.getManyAndCount();
    const unreadCount = await this.notificationsRepository.count({
      where: {
        recipientUser: { id: userId },
        isRead: false,
      },
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
      unreadCount,
    };
  }

  async markAsRead(id: string, userId: string) {
    const notification = await this.notificationsRepository.findOne({
      where: {
        id,
        recipientUser: { id: userId },
      },
    });

    if (!notification) {
      return { updated: false };
    }

    if (notification.isRead) {
      return { updated: false };
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await this.notificationsRepository.save(notification);
    this.notificationsGateway.emitNotificationUpdated(userId, {
      id: notification.id,
      isRead: true,
      readAt: notification.readAt.toISOString(),
    });

    return { updated: true };
  }

  async markAllAsRead(userId: string) {
    const result = await this.notificationsRepository.update(
      {
        recipientUser: { id: userId },
        isRead: false,
      },
      {
        isRead: true,
        readAt: new Date(),
      },
    );

    this.notificationsGateway.emitNotificationsReadAll(userId);

    return {
      updatedCount: result.affected ?? 0,
    };
  }

  async sendOrderConfirmation(order: Order): Promise<void> {
    if (!order.user?.email) {
      this.logger.warn(`Order ${order.id} has no customer email. Skipping confirmation email.`);
      return;
    }

    const appUrl = this.configService.get<string>('APP_URL')?.trim() || 'http://localhost:5173';
    const customerName = this.getUserDisplayName(order.user);
    const orderCode = order.id.slice(0, 8).toUpperCase();
    const items = order.items.map((item) => ({
      name: item.variant?.product?.name ?? item.variant?.sku ?? 'Producto',
      quantity: item.quantity,
      subtotal: Number(item.subtotal),
    }));

    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.ORDER_CONFIRMATION,
      context: {
        customerName,
        orderCode,
        orderUrl: `${appUrl}/orders/${order.id}`,
        items,
        total: Number(order.total),
        currency: order.currencyCode ?? 'USD',
      },
    });
  }

  async sendPasswordResetTemplate(input: {
    to: string;
    customerName: string;
    resetUrl: string;
    expiresIn: string;
  }): Promise<void> {
    await this.mailService.sendTemplate({
      to: input.to,
      key: EmailTemplateKey.AUTH_PASSWORD_RESET,
      context: {
        customerName: input.customerName,
        resetUrl: input.resetUrl,
        expiresIn: input.expiresIn,
      },
      throwOnError: true,
    });
  }

  async sendPaymentReceiptReceived(payment: {
    order: Order;
    amount: string;
    currencyCode: string;
  }): Promise<void> {
    const order = payment.order;
    if (!order?.user?.email) return;
    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.ORDER_PAYMENT_RECEIPT_RECEIVED,
      context: {
        customerName: this.getUserDisplayName(order.user),
        orderCode: order.id.slice(0, 8).toUpperCase(),
        orderUrl: `${this.getAppUrl()}/orders/${order.id}`,
        total: Number(payment.amount),
        currency: payment.currencyCode,
      },
    });
  }

  async sendPaymentApproved(payment: {
    order: Order;
    amount: string;
    currencyCode: string;
  }): Promise<void> {
    const order = payment.order;
    if (!order?.user?.email) return;
    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.ORDER_PAYMENT_APPROVED,
      context: {
        customerName: this.getUserDisplayName(order.user),
        orderCode: order.id.slice(0, 8).toUpperCase(),
        orderUrl: `${this.getAppUrl()}/orders/${order.id}`,
        total: Number(payment.amount),
        currency: payment.currencyCode,
      },
    });
  }

  async sendPaymentRejected(payment: {
    order: Order;
    rejectionReason: string | null;
  }): Promise<void> {
    const order = payment.order;
    if (!order?.user?.email) return;
    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.ORDER_PAYMENT_REJECTED,
      context: {
        customerName: this.getUserDisplayName(order.user),
        orderCode: order.id.slice(0, 8).toUpperCase(),
        orderUrl: `${this.getAppUrl()}/orders/${order.id}`,
        reason: payment.rejectionReason ?? '',
      },
    });
  }

  async sendShipmentCreated(shipment: {
    order: Order;
    carrier: string;
    trackingNumber: string;
    trackingUrl: string;
    estimatedDelivery: string;
  }): Promise<void> {
    const order = shipment.order;
    if (!order?.user?.email) return;
    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.SHIPMENT_CREATED,
      context: {
        customerName: this.getUserDisplayName(order.user),
        orderCode: order.id.slice(0, 8).toUpperCase(),
        orderUrl: `${this.getAppUrl()}/orders/${order.id}`,
        carrier: shipment.carrier,
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl,
        estimatedDelivery: shipment.estimatedDelivery,
      },
    });
  }

  async sendShipmentInTransit(shipment: {
    order: Order;
    trackingNumber: string;
    trackingUrl: string;
    estimatedDelivery: string;
  }): Promise<void> {
    const order = shipment.order;
    if (!order?.user?.email) return;
    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.SHIPMENT_IN_TRANSIT,
      context: {
        customerName: this.getUserDisplayName(order.user),
        orderCode: order.id.slice(0, 8).toUpperCase(),
        trackingNumber: shipment.trackingNumber,
        trackingUrl: shipment.trackingUrl,
        estimatedDelivery: shipment.estimatedDelivery,
      },
    });
  }

  async sendShipmentDelivered(shipment: {
    order: Order;
    deliveredAt: string;
  }): Promise<void> {
    const order = shipment.order;
    if (!order?.user?.email) return;
    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.SHIPMENT_DELIVERED,
      context: {
        customerName: this.getUserDisplayName(order.user),
        orderCode: order.id.slice(0, 8).toUpperCase(),
        deliveredAt: shipment.deliveredAt,
        reviewUrl: `${this.getAppUrl()}/orders/${order.id}/reviews`,
      },
    });
  }

  async sendReturnRequested(input: {
    order: Order;
    rmaNumber: string;
    reason: string;
  }): Promise<void> {
    const order = input.order;
    if (!order?.user?.email) return;
    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.RETURN_REQUESTED,
      context: {
        customerName: this.getUserDisplayName(order.user),
        orderCode: order.id.slice(0, 8).toUpperCase(),
        returnCode: input.rmaNumber,
        returnUrl: `${this.getAppUrl()}/returns/${input.rmaNumber}`,
        reason: input.reason,
      },
    });
  }

  async sendReturnApproved(input: {
    order: Order;
    rmaNumber: string;
    instructions: string;
  }): Promise<void> {
    const order = input.order;
    if (!order?.user?.email) return;
    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.RETURN_APPROVED,
      context: {
        customerName: this.getUserDisplayName(order.user),
        returnCode: input.rmaNumber,
        returnUrl: `${this.getAppUrl()}/returns/${input.rmaNumber}`,
        instructions: input.instructions,
      },
    });
  }

  async sendReturnRejected(input: {
    order: Order;
    rmaNumber: string;
    rejectionReason: string;
  }): Promise<void> {
    const order = input.order;
    if (!order?.user?.email) return;
    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.RETURN_REJECTED,
      context: {
        customerName: this.getUserDisplayName(order.user),
        returnCode: input.rmaNumber,
        returnUrl: `${this.getAppUrl()}/returns/${input.rmaNumber}`,
        reason: input.rejectionReason,
      },
    });
  }

  async sendReturnRefunded(input: {
    order: Order;
    rmaNumber: string;
    refundAmount: string;
    currencyCode: string;
    refundMethod: string;
  }): Promise<void> {
    const order = input.order;
    if (!order?.user?.email) return;
    await this.mailService.sendTemplate({
      to: order.user.email,
      key: EmailTemplateKey.RETURN_REFUNDED,
      context: {
        customerName: this.getUserDisplayName(order.user),
        returnCode: input.rmaNumber,
        returnUrl: `${this.getAppUrl()}/returns/${input.rmaNumber}`,
        refundAmount: Number(input.refundAmount),
        currency: input.currencyCode,
        refundMethod: input.refundMethod,
      },
    });
  }

  private getAppUrl(): string {
    return this.configService.get<string>('APP_URL')?.trim() || 'http://localhost:5173';
  }

  private async notifyAdmins(input: {
    type: NotificationType;
    actorUserId?: string;
    title: string;
    message: string;
    link?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const recipients = await this.usersRepository.find({
      where: {
        role: In([
          Role.ADMIN,
          Role.SUPER_ADMIN,
          Role.BOSS,
          Role.MARKETING,
          Role.SALES,
        ]),
        isActive: true,
      },
      select: {
        id: true,
      },
    });

    if (recipients.length === 0) {
      return;
    }

    const actor = input.actorUserId
      ? await this.usersRepository.findOne({ where: { id: input.actorUserId } })
      : null;

    const notifications = recipients.map((recipient) =>
      this.notificationsRepository.create({
        recipientUser: { id: recipient.id } as User,
        actorUser: actor ? ({ id: actor.id } as User) : null,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link ?? null,
        metadata: input.metadata ?? null,
      }),
    );

    const savedNotifications = await this.notificationsRepository.save(notifications);

    for (const [index, notification] of savedNotifications.entries()) {
      const recipientUserId = recipients[index]?.id;
      if (!recipientUserId) {
        continue;
      }

      this.notificationsGateway.emitNotificationCreated(recipientUserId, notification);
    }
  }

  private getUserDisplayName(user: Pick<User, 'firstName' | 'lastName' | 'email'>): string {
    return [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;
  }

  private formatCurrency(value: string | number, currencyCode = 'USD'): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2,
    }).format(Number(value));
  }
}
