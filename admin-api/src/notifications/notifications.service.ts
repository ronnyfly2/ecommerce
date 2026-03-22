import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Role } from '../common/enums/role.enum';
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { User } from '../users/entities/user.entity';
import { MAIL_PROVIDER_TOKEN } from './notifications.constants';
import { QueryNotificationsDto } from './dto/query-notifications.dto';
import { NotificationType } from './enums/notification-type.enum';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import type { MailMessage, MailProvider } from './notifications.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @Inject(MAIL_PROVIDER_TOKEN)
    private readonly mailProvider: MailProvider,
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
    const customerName = [order.user.firstName, order.user.lastName]
      .filter(Boolean)
      .join(' ')
      .trim() || order.user.email;
    const orderCode = order.id.slice(0, 8).toUpperCase();
    const itemsHtml = order.items
      .map((item) => {
        const productName = item.variant?.product?.name ?? item.variant?.sku ?? 'Producto';
        return `<li>${productName} x ${item.quantity} - ${this.formatCurrency(item.subtotal, order.currencyCode)}</li>`;
      })
      .join('');
    const itemsText = order.items
      .map((item) => {
        const productName = item.variant?.product?.name ?? item.variant?.sku ?? 'Producto';
        return `- ${productName} x ${item.quantity} - ${this.formatCurrency(item.subtotal, order.currencyCode)}`;
      })
      .join('\n');

    try {
      await this.mailProvider.send({
        to: order.user.email,
        subject: `Confirmacion de orden #${orderCode}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
            <h1 style="font-size: 24px; margin-bottom: 16px;">Tu orden fue recibida</h1>
            <p>Hola ${this.escapeHtml(customerName)},</p>
            <p>Recibimos tu orden <strong>#${orderCode}</strong> y ya la estamos procesando.</p>
            <p><strong>Total:</strong> ${this.formatCurrency(order.total, order.currencyCode)}</p>
            <h2 style="font-size: 18px; margin-top: 24px;">Items</h2>
            <ul>${itemsHtml}</ul>
            <p style="margin-top: 24px;">Puedes revisar el estado desde tu panel: <a href="${appUrl}/orders/${order.id}">${appUrl}/orders/${order.id}</a></p>
          </div>
        `,
        text: [
          `Hola ${customerName},`,
          '',
          `Recibimos tu orden #${orderCode}.`,
          `Total: ${this.formatCurrency(order.total, order.currencyCode)}`,
          '',
          'Items:',
          itemsText,
          '',
          `Ver orden: ${appUrl}/orders/${order.id}`,
        ].join('\n'),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown email error';
      this.logger.error(`Failed to send order confirmation for order ${order.id}: ${message}`);
    }
  }

  private formatCurrency(value: string | number, currencyCode = 'USD'): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: currencyCode || 'USD',
      minimumFractionDigits: 2,
    }).format(Number(value));
  }

  async sendPasswordResetEmail(message: MailMessage): Promise<void> {
    try {
      await this.mailProvider.send(message);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown email error';
      this.logger.error(`Failed to send password reset email: ${errorMsg}`);
      throw error;
    }
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
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
}
