import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Order } from '../orders/entities/order.entity';
import { MAIL_PROVIDER_TOKEN } from './notifications.constants';
import type { MailMessage, MailProvider } from './notifications.types';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @Inject(MAIL_PROVIDER_TOKEN)
    private readonly mailProvider: MailProvider,
    private readonly configService: ConfigService,
  ) {}

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
        return `<li>${productName} x ${item.quantity} - ${this.formatCurrency(item.subtotal)}</li>`;
      })
      .join('');
    const itemsText = order.items
      .map((item) => {
        const productName = item.variant?.product?.name ?? item.variant?.sku ?? 'Producto';
        return `- ${productName} x ${item.quantity} - ${this.formatCurrency(item.subtotal)}`;
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
            <p><strong>Total:</strong> ${this.formatCurrency(order.total)}</p>
            <h2 style="font-size: 18px; margin-top: 24px;">Items</h2>
            <ul>${itemsHtml}</ul>
            <p style="margin-top: 24px;">Puedes revisar el estado desde tu panel: <a href="${appUrl}/orders/${order.id}">${appUrl}/orders/${order.id}</a></p>
          </div>
        `,
        text: [
          `Hola ${customerName},`,
          '',
          `Recibimos tu orden #${orderCode}.`,
          `Total: ${this.formatCurrency(order.total)}`,
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

  private formatCurrency(value: string | number): string {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
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
}
