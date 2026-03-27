import {
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Role } from '../common/enums/role.enum';
import type { JwtPayload } from '../auth/types/jwt-payload.type';
import type { ChatMessage } from './entities/chat-message.entity';

type AuthSocket = Socket & {
  data: {
    userId?: string;
    role?: Role;
  };
};

@WebSocketGateway({
  namespace: '/chat',
  cors: {
    origin: true,
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(ChatGateway.name);

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
      await client.join(this.roomForAdmin(payload.sub));

      this.logger.debug(`Chat socket connected for admin ${payload.sub}`);
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'Unauthorized websocket connection';
      this.logger.warn(`Chat socket rejected: ${reason}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(@ConnectedSocket() client: AuthSocket): void {
    if (client.data.userId) {
      this.logger.debug(`Chat socket disconnected for admin ${client.data.userId}`);
    }
  }

  emitNewMessage(adminId: string, message: ChatMessage): void {
    this.server.to(this.roomForAdmin(adminId)).emit('chat.message', message);
  }

  emitNewGroupMessage(memberIds: string[], message: ChatMessage): void {
    for (const memberId of memberIds) {
      this.server.to(this.roomForAdmin(memberId)).emit('chat.group.message', message);
    }
  }

  emitReadReceipt(adminId: string, userId: string): void {
    this.server.to(this.roomForAdmin(adminId)).emit('chat.read', { userId });
  }

  emitGroupReadReceipt(memberIds: string[], groupId: string, userId: string): void {
    for (const memberId of memberIds) {
      this.server.to(this.roomForAdmin(memberId)).emit('chat.group.read', { groupId, userId });
    }
  }

  private roomForAdmin(adminId: string): string {
    return `admin:${adminId}`;
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
      throw new UnauthorizedException('Chat websocket is only available for admins');
    }
  }
}
