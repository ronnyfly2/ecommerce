import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { Order } from './order.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  @Column({ name: 'snapshot_product_name', type: 'varchar', nullable: true })
  snapshotProductName: string | null;

  @Column({ name: 'snapshot_sku', type: 'varchar', nullable: true })
  snapshotSku: string | null;

  @Column({ name: 'snapshot_descriptor', type: 'varchar', nullable: true })
  snapshotDescriptor: string | null;

  @Column({ type: 'int' })
  quantity: number;

  @Column({ name: 'unit_price', type: 'decimal', precision: 12, scale: 2 })
  unitPrice: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  subtotal: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
