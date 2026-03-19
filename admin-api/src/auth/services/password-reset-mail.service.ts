import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../notifications/notifications.service';
import type { MailMessage } from '../../notifications/notifications.types';
import { User } from '../../users/entities/user.entity';

@Injectable()
export class PasswordResetMailService {
  private readonly logger = new Logger(PasswordResetMailService.name);
  private readonly appUrl: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {
    this.appUrl = this.configService.get<string>('APP_URL') || 'http://localhost:5173';
  }

  async sendResetPasswordEmail(user: User, resetToken: string): Promise<void> {
    if (!user.email) {
      this.logger.warn(`User ${user.id} has no email. Skipping password reset email.`);
      return;
    }

    const resetLink = `${this.appUrl}/reset-password?token=${resetToken}`;
    const customerName = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

    const message: MailMessage = {
      to: user.email,
      subject: 'Recupera tu contraseña',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 640px; margin: 0 auto; color: #111827;">
          <h1 style="font-size: 24px; margin-bottom: 16px;">Recupera tu contraseña</h1>
          <p>Hola ${this.escapeHtml(customerName)},</p>
          <p>Recibimos una solicitud para restablecer tu contraseña. Si no fue tu, puedes ignorar este email.</p>
          <p style="margin-top: 24px;">
            <a href="${resetLink}" 
               style="display: inline-block; padding: 12px 24px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px;">
              Recuperar contraseña
            </a>
          </p>
          <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">O copia este link en tu navegador:</p>
          <p style="font-size: 12px; color: #6b7280; word-break: break-all;">${resetLink}</p>
          <p style="margin-top: 24px; font-size: 12px; color: #6b7280;">Este link vence en 1 hora.</p>
        </div>
      `,
      text: [
        'Hola ' + customerName,
        '',
        'Recupera tu contraseña:',
        resetLink,
        '',
        'Si no solicitaste esto, puedes ignorar este email.',
        '',
        'Este link vence en 1 hora.',
      ].join('\n'),
    };

    try {
      await this.notificationsService.sendPasswordResetEmail(message);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send password reset email for user ${user.id}: ${errorMsg}`);
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
