import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StringValue } from 'ms';
import { NotificationsModule } from '../notifications/notifications.module';
import { User } from '../users/entities/user.entity';
import { AuthController } from './auth.controller';
import { AuthRateLimiterService } from './auth-rate-limiter.service';
import { PasswordResetToken } from './entities/password-reset-token.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { PasswordResetMailService } from './services/password-reset-mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, RefreshToken, PasswordResetToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: (configService.get<string>('JWT_EXPIRES_IN') ??
            configService.getOrThrow<string>('JWT_EXPIRY')) as StringValue,
        },
      }),
    }),
    NotificationsModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, AuthRateLimiterService, PasswordResetMailService],
  exports: [AuthService],
})
export class AuthModule {}
