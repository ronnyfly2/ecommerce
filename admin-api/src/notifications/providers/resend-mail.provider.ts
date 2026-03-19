import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { MailMessage, MailProvider } from '../notifications.types';

@Injectable()
export class ResendMailProvider implements MailProvider {
  private readonly resend: Resend;
  private readonly from: string;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
    this.from =
      this.configService.get<string>('MAIL_FROM')?.trim() ||
      'Ecommerce <onboarding@resend.dev>';
  }

  async send(message: MailMessage): Promise<void> {
    await this.resend.emails.send({
      from: this.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
    });
  }
}
