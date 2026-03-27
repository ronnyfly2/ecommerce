import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Product } from './product.entity';

export enum ProductRecommendationType {
  RELATED = 'RELATED',
  SUGGESTED = 'SUGGESTED',
  VARIANT = 'VARIANT',
}

@Entity('product_recommendations')
@Unique('UQ_product_recommendation_unique', ['product', 'recommendedProduct', 'type'])
export class ProductRecommendation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Product, (product) => product.recommendations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'product_id' })
  product: Product;

  @ManyToOne(() => Product, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'recommended_product_id' })
  recommendedProduct: Product;

  @Column({
    name: 'recommendation_type',
    type: 'enum',
    enum: ProductRecommendationType,
  })
  type: ProductRecommendationType;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}