import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InventoryMovement } from './inventory-movement.entity';
import { ProductStoreStock } from './product-store-stock.entity';
import { Order } from '../../orders/entities/order.entity';

@Entity('stores')
export class Store {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', unique: true, length: 40 })
  code: string;

  @Column({ type: 'varchar', length: 140 })
  name: string;

  @Column({ type: 'varchar', length: 120 })
  city: string;

  @Column({ type: 'varchar', length: 120 })
  country: string;

  @Column({ type: 'varchar', nullable: true })
  address: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => ProductStoreStock, (stock) => stock.store)
  productStocks: ProductStoreStock[];

  @OneToMany(() => InventoryMovement, (movement) => movement.store)
  inventoryMovements: InventoryMovement[];

  @OneToMany(() => Order, (order) => order.pickupStore)
  pickupOrders: Order[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
