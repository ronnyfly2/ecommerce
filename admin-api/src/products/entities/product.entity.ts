import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { Coupon } from '../../coupons/entities/coupon.entity';
import { Tag } from '../../tags/entities/tag.entity';
import { ProductImage } from './product-image.entity';
import { ProductRecommendation } from './product-recommendation.entity';
import { ProductVariant } from './product-variant.entity';

export type ProductAttributeValue = {
  key: string;
  label: string;
  type: 'text' | 'number' | 'boolean' | 'select';
  unit: string | null;
  value: string | number | boolean;
};

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', unique: true })
  sku: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'base_price', type: 'decimal', precision: 12, scale: 2 })
  basePrice: string;

  @Column({ name: 'currency_code', type: 'varchar', length: 3, default: 'USD' })
  currencyCode: string;

  @Column({ type: 'int', default: 0 })
  stock: number;

  @Column({ name: 'weight_value', type: 'decimal', precision: 10, scale: 3, nullable: true })
  weightValue: string | null;

  @Column({ name: 'weight_unit', type: 'varchar', length: 10, nullable: true })
  weightUnit: string | null;

  @Column({ name: 'length_value', type: 'decimal', precision: 10, scale: 2, nullable: true })
  lengthValue: string | null;

  @Column({ name: 'width_value', type: 'decimal', precision: 10, scale: 2, nullable: true })
  widthValue: string | null;

  @Column({ name: 'height_value', type: 'decimal', precision: 10, scale: 2, nullable: true })
  heightValue: string | null;

  @Column({ name: 'dimension_unit', type: 'varchar', length: 10, nullable: true })
  dimensionUnit: string | null;

  @Column({ name: 'attribute_values', type: 'jsonb', default: () => "'[]'" })
  attributeValues: ProductAttributeValue[];

  @ManyToOne(() => Category, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @ManyToOne(() => Coupon, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'coupon_id' })
  coupon: Coupon | null;

  @Column({ name: 'coupon_link', type: 'varchar', nullable: true })
  couponLink: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'is_featured', default: false })
  isFeatured: boolean;

  @Column({ name: 'has_offer', default: false })
  hasOffer: boolean;

  @Column({ name: 'offer_price', type: 'decimal', precision: 12, scale: 2, nullable: true })
  offerPrice: string | null;

  @Column({ name: 'offer_percentage', type: 'decimal', precision: 5, scale: 2, nullable: true })
  offerPercentage: string | null;

  @ManyToMany(() => Tag)
  @JoinTable({
    name: 'product_tags',
    joinColumn: { name: 'product_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'tag_id', referencedColumnName: 'id' },
  })
  tags: Tag[];

  @OneToMany(() => ProductRecommendation, (recommendation) => recommendation.product)
  recommendations: ProductRecommendation[];

  @OneToMany(() => ProductVariant, (variant) => variant.product)
  variants: ProductVariant[];

  @OneToMany(() => ProductImage, (image) => image.product)
  images: ProductImage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
