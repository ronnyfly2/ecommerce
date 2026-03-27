import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('chat_group_members')
export class ChatGroupMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @CreateDateColumn({ name: 'joined_at' })
  joinedAt: Date;
}
