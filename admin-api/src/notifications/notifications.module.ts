import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MAIL_PROVIDER_TOKEN } from './notifications.constants';
import { NotificationsService } from './notifications.service';
import { NoopMailProvider } from './providers/noop-mail.provider';
import { ResendMailProvider } from './providers/resend-mail.provider';

@Module({
  imports: [ConfigModule],
  providers: [
    NoopMailProvider,
    {
      provide: MAIL_PROVIDER_TOKEN,
      inject: [ConfigService, NoopMailProvider],
      useFactory: (
        configService: ConfigService,
        noopMailProvider: NoopMailProvider,
      ) => {
        const provider = configService.get<string>('MAIL_PROVIDER')?.trim().toLowerCase() ?? 'noop';
        const hasResendKey = Boolean(configService.get<string>('RESEND_API_KEY')?.trim());

        if (provider === 'resend' && hasResendKey) {
          return new ResendMailProvider(configService);
        }

        return noopMailProvider;
      },
    },
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
