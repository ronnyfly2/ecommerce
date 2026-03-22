import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { MAIL_PROVIDER_TOKEN } from './notifications.constants';
import { NotificationsController } from './notifications.controller';
import { Notification } from './entities/notification.entity';
import { NotificationsGateway } from './notifications.gateway';
import { NotificationsService } from './notifications.service';
import { NoopMailProvider } from './providers/noop-mail.provider';
import { ResendMailProvider } from './providers/resend-mail.provider';

@Module({
  imports: [ConfigModule, JwtModule.register({}), TypeOrmModule.forFeature([Notification, User])],
  controllers: [NotificationsController],
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
    NotificationsGateway,
    NotificationsService,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
