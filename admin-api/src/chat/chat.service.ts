import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { ChatGateway } from './chat.gateway';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { ChatMessage } from './entities/chat-message.entity';

export interface ConversationSummary {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  avatar: string | null;
  role: string;
  lastMessageContent: string;
  lastMessageAt: string;
  lastMessageSenderId: string | null;
  unreadCount: number;
}

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly messageTimestamps = new Map<string, number[]>();
  private readonly MAX_MESSAGES_PER_MINUTE = 20;
  private readonly MESSAGE_WINDOW_MS = 60000; // 1 minuto

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly gateway: ChatGateway,
  ) {}

  async getConversations(adminId: string): Promise<ConversationSummary[]> {
    const rows = await this.chatRepository.query(
      `
      SELECT
        u.id AS "userId",
        u.email AS "email",
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.avatar AS "avatar",
        u.role AS "role",
        lm.content AS "lastMessageContent",
        lm.created_at AS "lastMessageAt",
        lm.sender_id AS "lastMessageSenderId",
        COALESCE(unread.cnt, 0)::int AS "unreadCount"
      FROM users u
      INNER JOIN LATERAL (
        SELECT cm.content, cm.created_at, cm.sender_id
        FROM chat_messages cm
        WHERE (cm.sender_id = u.id AND cm.recipient_id = $1)
           OR (cm.sender_id = $1 AND cm.recipient_id = u.id)
        ORDER BY cm.created_at DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM chat_messages cm
        WHERE cm.sender_id = u.id
          AND cm.recipient_id = $1
          AND cm.is_read = false
      ) unread ON TRUE
      WHERE u.id != $1
      ORDER BY lm.created_at DESC
      `,
      [adminId],
    );

    return rows as ConversationSummary[];
  }

  async getMessages(adminId: string, userId: string, query: QueryMessagesDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 40, 100);

    const [messages, total] = await this.chatRepository.findAndCount({
      where: [
        { senderId: adminId, recipientId: userId },
        { senderId: userId, recipientId: adminId },
      ],
      relations: ['sender'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items: messages.reverse(),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async sendMessage(adminId: string, recipientId: string, content: string): Promise<ChatMessage> {
    // Rate limiting
    this.checkRateLimit(adminId);

    // Sanitización
    const sanitized = this.sanitizeMessage(content);

    if (!sanitized) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const recipient = await this.usersRepository.findOne({ where: { id: recipientId } });
    if (!recipient) {
      throw new NotFoundException('User not found');
    }

    const message = this.chatRepository.create({
      senderId: adminId,
      recipientId,
      content: sanitized,
    });

    const saved = await this.chatRepository.save(message);

    const full = await this.chatRepository.findOne({
      where: { id: saved.id },
      relations: ['sender'],
    });

    this.gateway.emitNewMessage(adminId, full!);

    return full!;
  }

  async markAsRead(adminId: string, userId: string): Promise<{ updated: number }> {
    const result = await this.chatRepository
      .createQueryBuilder()
      .update(ChatMessage)
      .set({ isRead: true, readAt: new Date() })
      .where('sender_id = :userId AND recipient_id = :adminId AND is_read = false', {
        userId,
        adminId,
      })
      .execute();

    this.gateway.emitReadReceipt(adminId, userId);

    return { updated: result.affected ?? 0 };
  }

  private checkRateLimit(adminId: string): void {
    const now = Date.now();
    const key = `chat:${adminId}`;
    const timestamps = this.messageTimestamps.get(key) ?? [];

    // Remover timestamps antiguos
    const recentTimestamps = timestamps.filter((ts) => now - ts < this.MESSAGE_WINDOW_MS);

    if (recentTimestamps.length >= this.MAX_MESSAGES_PER_MINUTE) {
      throw new HttpException(
        'Too many messages. Please wait before sending another message.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recentTimestamps.push(now);
    this.messageTimestamps.set(key, recentTimestamps);
  }

  private sanitizeMessage(content: string): string {
    // Remover tags HTML peligrosos
    let sanitized = content
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<img[^>]*>/gi, '') // Remover tags img inline
      .replace(/on\w+\s*=/gi, '') // Remover event handlers

    // Limitar longitud
    sanitized = sanitized.substring(0, 2000).trim()

    return sanitized
  }
}
