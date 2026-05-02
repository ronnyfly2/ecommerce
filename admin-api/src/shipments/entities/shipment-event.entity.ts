import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Shipment } from './shipment.entity';
import { ShipmentEventType } from '../enums/shipment-event-type.enum';
import { ShipmentStatus } from '../enums/shipment-status.enum';

@Entity('shipment_events')
@Index(['shipment'])
export class ShipmentEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Shipment, (shipment) => shipment.events, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipment_id' })
  shipment: Shipment;

  @Column({
    type: 'enum',
    enum: ShipmentEventType,
    default: ShipmentEventType.NOTE,
  })
  type: ShipmentEventType;

  @Column({
    type: 'enum',
    enum: ShipmentStatus,
    nullable: true,
  })
  status: ShipmentStatus | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  location: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  lat: string | null;

  @Column({ type: 'decimal', precision: 10, scale: 6, nullable: true })
  lng: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'occurred_at', type: 'timestamptz' })
  occurredAt: Date;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
