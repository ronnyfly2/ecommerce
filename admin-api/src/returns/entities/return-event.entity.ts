import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { ReturnRequest } from './return-request.entity';
import { ReturnEventType } from '../enums/return-event-type.enum';
import { ReturnStatus } from '../enums/return-status.enum';

@Entity('return_events')
export class ReturnEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ReturnRequest, (request) => request.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'return_id' })
  returnRequest: ReturnRequest;

  @Column({
    type: 'enum',
    enum: ReturnEventType,
    default: ReturnEventType.NOTE,
  })
  type: ReturnEventType;

  @Column({ type: 'enum', enum: ReturnStatus, nullable: true })
  status: ReturnStatus | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
