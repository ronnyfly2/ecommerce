import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../../orders/entities/order.entity';
import { Carrier } from './carrier.entity';
import { ShipmentItem } from './shipment-item.entity';
import { ShipmentEvent } from './shipment-event.entity';
import { ShipmentStatus } from '../enums/shipment-status.enum';

@Entity('shipments')
@Index(['status'])
export class Shipment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Carrier, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'carrier_id' })
  carrier: Carrier | null;

  @Column({
    type: 'enum',
    enum: ShipmentStatus,
    default: ShipmentStatus.PENDING,
  })
  status: ShipmentStatus;

  @Column({ name: 'tracking_number', type: 'varchar', length: 120, nullable: true })
  trackingNumber: string | null;

  @Column({ name: 'tracking_url', type: 'text', nullable: true })
  trackingUrl: string | null;

  @Column({ name: 'shipping_cost', type: 'decimal', precision: 12, scale: 2, default: 0 })
  shippingCost: string;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'USD' })
  currencyCode: string;

  // Destination snapshot (independent of shipping_addresses)
  @Column({ name: 'ship_to_name', type: 'varchar', length: 200, nullable: true })
  shipToName: string | null;

  @Column({ name: 'ship_to_street', type: 'varchar', length: 200, nullable: true })
  shipToStreet: string | null;

  @Column({ name: 'ship_to_city', type: 'varchar', length: 120, nullable: true })
  shipToCity: string | null;

  @Column({ name: 'ship_to_state', type: 'varchar', length: 120, nullable: true })
  shipToState: string | null;

  @Column({ name: 'ship_to_postal_code', type: 'varchar', length: 30, nullable: true })
  shipToPostalCode: string | null;

  @Column({ name: 'ship_to_country', type: 'varchar', length: 120, nullable: true })
  shipToCountry: string | null;

  @Column({ name: 'ship_to_phone', type: 'varchar', length: 40, nullable: true })
  shipToPhone: string | null;

  @Column({ name: 'ship_to_lat', type: 'decimal', precision: 10, scale: 6, nullable: true })
  shipToLat: string | null;

  @Column({ name: 'ship_to_lng', type: 'decimal', precision: 10, scale: 6, nullable: true })
  shipToLng: string | null;

  @Column({ name: 'estimated_delivery_at', type: 'timestamptz', nullable: true })
  estimatedDeliveryAt: Date | null;

  @Column({ name: 'shipped_at', type: 'timestamptz', nullable: true })
  shippedAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', default: () => `'{}'::jsonb` })
  metadata: Record<string, unknown>;

  @OneToMany(() => ShipmentItem, (item) => item.shipment, { cascade: true })
  items: ShipmentItem[];

  @OneToMany(() => ShipmentEvent, (event) => event.shipment, { cascade: true })
  events: ShipmentEvent[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
