import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type CategoryAttributeDefinitionType = 'text' | 'number' | 'boolean' | 'select';

export type CategoryAttributeDefinition = {
  key: string;
  label: string;
  type: CategoryAttributeDefinitionType;
  unit: string | null;
  required: boolean;
  options: string[];
  helpText: string | null;
  displayOrder: number;
  isActive: boolean;
};

@Entity('categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true })
  name: string;

  @Column({ type: 'varchar', unique: true })
  slug: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', nullable: true })
  image: string | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @Column({ name: 'supports_size_color_variants', default: true })
  supportsSizeColorVariants: boolean;

  @Column({ name: 'supports_dimensions', default: false })
  supportsDimensions: boolean;

  @Column({ name: 'supports_weight', default: false })
  supportsWeight: boolean;

  @Column({ name: 'attribute_definitions', type: 'jsonb', default: () => "'[]'" })
  attributeDefinitions: CategoryAttributeDefinition[];

  @ManyToOne(() => Category, (category) => category.children, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'parent_id' })
  parent: Category | null;

  @OneToMany(() => Category, (category) => category.parent)
  children: Category[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
