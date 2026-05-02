import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OrderItem } from '../../orders/entities/order-item.entity';
import { ReturnRequest } from './return-request.entity';
import { ReturnReason } from '../enums/return-reason.enum';

@Entity('return_items')
export class ReturnItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ReturnRequest, (request) => request.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'return_id' })
  returnRequest: ReturnRequest;

  @ManyToOne(() => OrderItem, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'order_item_id' })
  orderItem: OrderItem;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ type: 'enum', enum: ReturnReason, nullable: true })
  reason: ReturnReason | null;

  @Column({ name: 'condition_notes', type: 'text', nullable: true })
  conditionNotes: string | null;

  @Column({ type: 'boolean', default: true })
  restockable: boolean;

  @Column({ name: 'received_quantity', type: 'int', nullable: true })
  receivedQuantity: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
