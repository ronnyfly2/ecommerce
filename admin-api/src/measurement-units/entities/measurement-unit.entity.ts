import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export const MEASUREMENT_UNIT_FAMILIES = [
  'weight',
  'length',
  'volume',
  'area',
  'count',
  'temperature',
  'time',
] as const;

export type MeasurementUnitFamily = typeof MEASUREMENT_UNIT_FAMILIES[number];

@Entity('measurement_units')
export class MeasurementUnit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 30, unique: true })
  code: string;

  @Column({ type: 'varchar', length: 120 })
  label: string;

  @Column({ type: 'varchar', length: 30 })
  family: MeasurementUnitFamily;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Column({ name: 'display_order', type: 'int', default: 0 })
  displayOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}