import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from '../../notifications/notifications.service';
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

    const resetUrl = `${this.appUrl}/reset-password?token=${resetToken}`;
    const customerName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

    try {
      await this.notificationsService.sendPasswordResetTemplate({
        to: user.email,
        customerName,
        resetUrl,
        expiresIn: '1 hora',
      });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to send password reset email for user ${user.id}: ${errorMsg}`);
      throw error;
    }
  }
}
