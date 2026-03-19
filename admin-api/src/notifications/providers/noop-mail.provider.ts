import { Injectable, Logger } from '@nestjs/common';
import type { MailMessage, MailProvider } from '../notifications.types';

@Injectable()
export class NoopMailProvider implements MailProvider {
  private readonly logger = new Logger(NoopMailProvider.name);

  async send(message: MailMessage): Promise<void> {
    this.logger.warn(
      `Email skipped. Provider disabled or not configured. Subject: ${message.subject}, To: ${message.to}`,
    );
  }
}
