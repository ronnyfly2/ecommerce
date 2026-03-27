import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ChatGroup } from './chat-group.entity';
import { ChatMessageType } from '../enums/chat-message-type.enum';

@Entity('chat_messages')
export class ChatMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'sender_id' })
  sender: User | null;

  @Column({ name: 'sender_id', type: 'uuid', nullable: true })
  senderId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'recipient_id' })
  recipient: User | null;

  @Column({ name: 'recipient_id', type: 'uuid', nullable: true })
  recipientId: string | null;

  @ManyToOne(() => ChatGroup, { onDelete: 'SET NULL', nullable: true, eager: false })
  @JoinColumn({ name: 'group_id' })
  group: ChatGroup | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @Column({ type: 'text' })
  content: string;

  @Column({
    name: 'message_type',
    type: 'varchar',
    length: 20,
    default: ChatMessageType.TEXT,
  })
  messageType: ChatMessageType;

  @Column({ name: 'attachment_url', type: 'varchar', nullable: true })
  attachmentUrl: string | null;

  @Column({ name: 'attachment_name', type: 'varchar', length: 255, nullable: true })
  attachmentName: string | null;

  @Column({ name: 'attachment_mime', type: 'varchar', length: 150, nullable: true })
  attachmentMime: string | null;

  @Column({ name: 'attachment_size', type: 'int', nullable: true })
  attachmentSize: number | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
