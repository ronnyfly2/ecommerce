import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { extname } from 'path';
import type { Multer } from 'multer';
import { User } from '../users/entities/user.entity';
import { ChatGateway } from './chat.gateway';
import { CreateGroupDto } from './dto/create-group.dto';
import { QueryMessagesDto } from './dto/query-messages.dto';
import { BACKOFFICE_ROLES } from '../common/auth/role-groups';
import { Role } from '../common/enums/role.enum';
import { ChatGroupMember } from './entities/chat-group-member.entity';
import { ChatGroup } from './entities/chat-group.entity';
import { ChatMessage } from './entities/chat-message.entity';
import { ChatMessageType } from './enums/chat-message-type.enum';

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

export interface GroupConversationSummary {
  groupId: string;
  name: string;
  lastMessageContent: string;
  lastMessageAt: string;
  lastMessageSenderId: string | null;
  unreadCount: number;
  memberCount: number;
}

type ChatUploadMeta = {
  messageType: ChatMessageType;
  attachmentUrl: string;
  attachmentName: string;
  attachmentMime: string;
  attachmentSize: number;
};

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);
  private readonly messageTimestamps = new Map<string, number[]>();
  private readonly uploadTimestamps = new Map<string, number[]>();
  private readonly MAX_MESSAGES_PER_MINUTE = 20;
  private readonly MAX_UPLOADS_PER_MINUTE = 10;
  private readonly MESSAGE_WINDOW_MS = 60000; // 1 minuto
  private readonly MAX_MESSAGE_LENGTH = 2000;
  private readonly MAX_GROUP_MEMBERS = 50;
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024;
  private readonly allowedImageMimes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
  ]);
  private readonly allowedDocumentMimes = new Set([
    'application/pdf',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ]);
  private readonly allowedExtensions = new Set([
    '.jpg',
    '.jpeg',
    '.png',
    '.webp',
    '.gif',
    '.pdf',
    '.txt',
    '.doc',
    '.docx',
    '.xls',
    '.xlsx',
  ]);

  constructor(
    @InjectRepository(ChatMessage)
    private readonly chatRepository: Repository<ChatMessage>,
    @InjectRepository(ChatGroup)
    private readonly groupRepository: Repository<ChatGroup>,
    @InjectRepository(ChatGroupMember)
    private readonly groupMembersRepository: Repository<ChatGroupMember>,
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

  async getGroupConversations(adminId: string): Promise<GroupConversationSummary[]> {
    const rows = await this.groupRepository.query(
      `
      SELECT
        g.id AS "groupId",
        g.name AS "name",
        COALESCE(lm.content, '') AS "lastMessageContent",
        COALESCE(lm.created_at, g.created_at) AS "lastMessageAt",
        lm.sender_id AS "lastMessageSenderId",
        COALESCE(unread.cnt, 0)::int AS "unreadCount",
        COALESCE(members.cnt, 0)::int AS "memberCount"
      FROM chat_groups g
      INNER JOIN chat_group_members gm ON gm.group_id = g.id AND gm.user_id = $1
      LEFT JOIN LATERAL (
        SELECT cm.content, cm.created_at, cm.sender_id
        FROM chat_messages cm
        WHERE cm.group_id = g.id
        ORDER BY cm.created_at DESC
        LIMIT 1
      ) lm ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM chat_messages cm
        WHERE cm.group_id = g.id
          AND cm.sender_id != $1
          AND cm.created_at > COALESCE(gm.last_read_at, '1970-01-01'::timestamptz)
      ) unread ON TRUE
      LEFT JOIN LATERAL (
        SELECT COUNT(*) AS cnt
        FROM chat_group_members gm2
        WHERE gm2.group_id = g.id
      ) members ON TRUE
      WHERE g.is_active = true
      ORDER BY COALESCE(lm.created_at, g.created_at) DESC
      `,
      [adminId],
    );

    return rows as GroupConversationSummary[];
  }

  async getMessages(adminId: string, userId: string, query: QueryMessagesDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 40, 100);

    const [messages, total] = await this.chatRepository.findAndCount({
      where: [
        { senderId: adminId, recipientId: userId, groupId: IsNull() },
        { senderId: userId, recipientId: adminId, groupId: IsNull() },
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

  async getGroupMessages(adminId: string, groupId: string, query: QueryMessagesDto) {
    await this.ensureGroupMembership(adminId, groupId);

    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 40, 100);

    const [messages, total] = await this.chatRepository.findAndCount({
      where: { groupId },
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

  async createGroup(adminId: string, dto: CreateGroupDto) {
    const uniqueMemberIds = Array.from(new Set([...dto.memberIds, adminId]));

    if (uniqueMemberIds.length > this.MAX_GROUP_MEMBERS) {
      throw new BadRequestException(`Group cannot have more than ${this.MAX_GROUP_MEMBERS} members`);
    }

    const users = await this.usersRepository.findBy({ id: In(uniqueMemberIds) });
    if (users.length !== uniqueMemberIds.length) {
      throw new BadRequestException('One or more users do not exist');
    }

    const allowedRoles = new Set<string>(BACKOFFICE_ROLES as readonly string[]);
    const hasInvalidRole = users.some((user) => !allowedRoles.has(user.role));
    if (hasInvalidRole) {
      throw new BadRequestException('Group members must be backoffice users');
    }

    const group = this.groupRepository.create({
      name: dto.name.trim(),
      createdById: adminId,
      isActive: true,
    });

    const savedGroup = await this.groupRepository.save(group);

    const members = uniqueMemberIds.map((userId) =>
      this.groupMembersRepository.create({
        groupId: savedGroup.id,
        userId,
      }),
    );

    await this.groupMembersRepository.save(members);

    return {
      id: savedGroup.id,
      name: savedGroup.name,
      memberIds: uniqueMemberIds,
      createdAt: savedGroup.createdAt,
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

    if (recipientId === adminId) {
      throw new BadRequestException('Cannot send direct messages to yourself');
    }

    const message = this.chatRepository.create({
      senderId: adminId,
      recipientId,
      groupId: null,
      content: sanitized,
      messageType: ChatMessageType.TEXT,
      attachmentUrl: null,
      attachmentName: null,
      attachmentMime: null,
      attachmentSize: null,
    });

    const saved = await this.chatRepository.save(message);

    const full = await this.chatRepository.findOne({
      where: { id: saved.id },
      relations: ['sender'],
    });

    this.gateway.emitNewMessage(adminId, full!);

    return full!;
  }

  async sendGroupMessage(adminId: string, groupId: string, content: string): Promise<ChatMessage> {
    this.checkRateLimit(adminId);
    const sanitized = this.sanitizeMessage(content);

    if (!sanitized) {
      throw new BadRequestException('Message content cannot be empty');
    }

    const memberIds = await this.ensureGroupMembership(adminId, groupId);

    const message = this.chatRepository.create({
      senderId: adminId,
      recipientId: null,
      groupId,
      content: sanitized,
      messageType: ChatMessageType.TEXT,
      attachmentUrl: null,
      attachmentName: null,
      attachmentMime: null,
      attachmentSize: null,
    });

    const saved = await this.chatRepository.save(message);
    const full = await this.chatRepository.findOne({ where: { id: saved.id }, relations: ['sender'] });

    this.gateway.emitNewGroupMessage(memberIds, full!);
    return full!;
  }

  async sendAttachmentToUser(adminId: string, recipientId: string, file: Multer.File): Promise<ChatMessage> {
    this.checkUploadRateLimit(adminId);

    const recipient = await this.usersRepository.findOne({ where: { id: recipientId } });
    if (!recipient) {
      throw new NotFoundException('User not found');
    }

    const uploadMeta = this.validateAndBuildUploadMeta(file);
    return this.sendAttachmentMessage({
      adminId,
      recipientId,
      groupId: null,
      memberIds: [adminId],
      uploadMeta,
    });
  }

  async sendGroupAttachment(adminId: string, groupId: string, file: Multer.File): Promise<ChatMessage> {
    this.checkUploadRateLimit(adminId);
    const memberIds = await this.ensureGroupMembership(adminId, groupId);
    const uploadMeta = this.validateAndBuildUploadMeta(file);

    return this.sendAttachmentMessage({
      adminId,
      recipientId: null,
      groupId,
      memberIds,
      uploadMeta,
    });
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

  async markGroupAsRead(adminId: string, groupId: string): Promise<{ updated: number }> {
    const memberIds = await this.ensureGroupMembership(adminId, groupId);

    const result = await this.groupMembersRepository
      .createQueryBuilder()
      .update(ChatGroupMember)
      .set({ lastReadAt: new Date() })
      .where('group_id = :groupId AND user_id = :adminId', { groupId, adminId })
      .execute();

    this.gateway.emitGroupReadReceipt(memberIds, groupId, adminId);
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

  private checkUploadRateLimit(adminId: string): void {
    const now = Date.now();
    const key = `chat-upload:${adminId}`;
    const timestamps = this.uploadTimestamps.get(key) ?? [];
    const recentTimestamps = timestamps.filter((ts) => now - ts < this.MESSAGE_WINDOW_MS);

    if (recentTimestamps.length >= this.MAX_UPLOADS_PER_MINUTE) {
      throw new HttpException(
        'Too many uploads. Please wait before uploading another file.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    recentTimestamps.push(now);
    this.uploadTimestamps.set(key, recentTimestamps);
  }

  private sanitizeMessage(content: string): string {
    // Remover tags HTML peligrosos
    let sanitized = content
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<img[^>]*>/gi, '') // Remover tags img inline
      .replace(/on\w+\s*=/gi, '') // Remover event handlers
      .replace(/javascript:/gi, '')
      .replace(/[\u0000-\u001F\u007F]/g, ' ')

    // Limitar longitud
    sanitized = sanitized.substring(0, this.MAX_MESSAGE_LENGTH).replace(/\s+/g, ' ').trim();

    return sanitized;
  }

  private async ensureGroupMembership(adminId: string, groupId: string): Promise<string[]> {
    const group = await this.groupRepository.findOne({ where: { id: groupId, isActive: true } });
    if (!group) {
      throw new NotFoundException('Group not found');
    }

    const member = await this.groupMembersRepository.findOne({ where: { groupId, userId: adminId } });
    if (!member) {
      throw new UnauthorizedException('You are not a member of this group');
    }

    const members = await this.groupMembersRepository.find({ where: { groupId } });
    return members.map((m) => m.userId);
  }

  private validateAndBuildUploadMeta(file: Multer.File): ChatUploadMeta {
    if (!file) {
      throw new BadRequestException('Missing file upload');
    }

    if (!file.mimetype) {
      throw new BadRequestException('Invalid file type');
    }

    if (file.size > this.MAX_FILE_SIZE) {
      throw new BadRequestException('File too large');
    }

    const extension = extname(file.originalname || '').toLowerCase();
    if (!this.allowedExtensions.has(extension)) {
      throw new BadRequestException('File extension is not allowed');
    }

    const isImage = this.allowedImageMimes.has(file.mimetype);
    const isDocument = this.allowedDocumentMimes.has(file.mimetype);

    if (!isImage && !isDocument) {
      throw new BadRequestException('File type is not allowed');
    }

    const safeName = (file.originalname || 'file')
      .replace(/[^a-zA-Z0-9._\-\s]/g, '')
      .trim()
      .substring(0, 120);

    const relativePath = file.path.replace(/\\/g, '/');
    const uploadsIdx = relativePath.lastIndexOf('/uploads/');
    const publicPath = uploadsIdx >= 0 ? relativePath.substring(uploadsIdx + 8) : `chat/${file.filename}`;

    return {
      messageType: isImage ? ChatMessageType.IMAGE : ChatMessageType.DOCUMENT,
      attachmentUrl: `/uploads/${publicPath}`,
      attachmentName: safeName || file.filename,
      attachmentMime: file.mimetype,
      attachmentSize: file.size,
    };
  }

  private async sendAttachmentMessage(params: {
    adminId: string;
    recipientId: string | null;
    groupId: string | null;
    memberIds: string[];
    uploadMeta: ChatUploadMeta;
  }): Promise<ChatMessage> {
    const { adminId, recipientId, groupId, memberIds, uploadMeta } = params;

    const message = this.chatRepository.create({
      senderId: adminId,
      recipientId,
      groupId,
      content: uploadMeta.attachmentName,
      messageType: uploadMeta.messageType,
      attachmentUrl: uploadMeta.attachmentUrl,
      attachmentName: uploadMeta.attachmentName,
      attachmentMime: uploadMeta.attachmentMime,
      attachmentSize: uploadMeta.attachmentSize,
    });

    const saved = await this.chatRepository.save(message);
    const full = await this.chatRepository.findOne({ where: { id: saved.id }, relations: ['sender'] });

    if (groupId) {
      this.gateway.emitNewGroupMessage(memberIds, full!);
    } else {
      this.gateway.emitNewMessage(adminId, full!);
    }

    return full!;
  }
}
