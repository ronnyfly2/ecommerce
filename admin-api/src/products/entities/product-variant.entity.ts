import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Color } from '../../colors/entities/color.entity';
import { Size } from '../../sizes/entities/size.entity';
import { Product } from './product.entity';

@Entity('product_variants')
export class ProductVariant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (product) => product.variants, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Size, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'size_id' })
  size: Size;

  @ManyToOne(() => Color, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'color_id' })
  color: Color;

  @Column({ type: 'varchar', unique: true })
  sku: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ name: 'additional_price', type: 'decimal', precision: 12, scale: 2, default: 0 })
  additionalPrice: string;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
