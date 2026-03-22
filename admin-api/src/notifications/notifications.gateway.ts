import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Role } from '../common/enums/role.enum';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import { Notification } from './entities/notification.entity';

type AuthSocket = Socket & {
  data: {
    userId?: string;
    role?: Role;
  };
};

@WebSocketGateway({
  namespace: '/notifications',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async handleConnection(@ConnectedSocket() client: AuthSocket): Promise<void> {
    try {
      const token = this.extractToken(client);
      const payload = this.verifyToken(token);
      this.ensureAdminRole(payload.role);

      client.data.userId = payload.sub;
      client.data.role = payload.role;
      await client.join(this.roomForUser(payload.sub));

      this.logger.debug(`Notifications socket connected for user ${payload.sub}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unauthorized websocket connection';
      this.logger.warn(`Notifications socket rejected: ${reason}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: AuthSocket): void {
    if (client.data.userId) {
      this.logger.debug(`Notifications socket disconnected for user ${client.data.userId}`);
    }
  }

  @SubscribeMessage('notifications.ping')
  handlePing(@ConnectedSocket() client: AuthSocket, @MessageBody() payload?: { ts?: number }) {
    if (!client.data.userId) {
      return;
    }

    client.emit('notifications.pong', {
      ts: payload?.ts ?? Date.now(),
    });
  }

  emitNotificationCreated(recipientUserId: string, notification: Notification): void {
    this.server.to(this.roomForUser(recipientUserId)).emit('notification.created', notification);
  }

  emitNotificationUpdated(recipientUserId: string, payload: { id: string; isRead: boolean; readAt: string | null }): void {
    this.server.to(this.roomForUser(recipientUserId)).emit('notification.updated', payload);
  }

  emitNotificationsReadAll(recipientUserId: string): void {
    this.server.to(this.roomForUser(recipientUserId)).emit('notification.read-all', {
      recipientUserId,
    });
  }

  private roomForUser(userId: string): string {
    return `user:${userId}`;
  }

  private extractToken(client: AuthSocket): string {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) {
      return authToken.replace(/^Bearer\s+/i, '').trim();
    }

    const headerAuth = client.handshake.headers.authorization;
    if (typeof headerAuth === 'string' && headerAuth.trim()) {
      return headerAuth.replace(/^Bearer\s+/i, '').trim();
    }

    throw new UnauthorizedException('Missing websocket token');
  }

  private verifyToken(token: string): JwtPayload {
    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const payload = this.jwtService.verify<JwtPayload>(token, { secret });

    if (payload.tokenType !== 'access') {
      throw new UnauthorizedException('Invalid websocket token type');
    }

    return payload;
  }

  private ensureAdminRole(role: Role): void {
    if (
      ![
        Role.ADMIN,
        Role.SUPER_ADMIN,
        Role.BOSS,
        Role.MARKETING,
        Role.SALES,
      ].includes(role)
    ) {
      throw new UnauthorizedException('Notifications websocket is only available for admins');
    }
  }
}
