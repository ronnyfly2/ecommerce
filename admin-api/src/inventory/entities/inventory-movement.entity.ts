import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Product } from '../../products/entities/product.entity';
import { ProductVariant } from '../../products/entities/product-variant.entity';
import { User } from '../../users/entities/user.entity';
import { InventoryMovementType } from '../enums/inventory-movement-type.enum';

@Entity('inventory_movements')
export class InventoryMovement {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, { nullable: true, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'product_id' })
  product: Product | null;

  @ManyToOne(() => ProductVariant, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'variant_id' })
  variant: ProductVariant | null;

  @Column({ type: 'int' })
  quantityChange: number;

  @Column({
    type: 'enum',
    enum: InventoryMovementType,
  })
  type: InventoryMovementType;

  @Column({ type: 'varchar', nullable: true })
  reason: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
