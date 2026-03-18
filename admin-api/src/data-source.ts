import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { User } from './users/entities/user.entity';
import { Size } from './sizes/entities/size.entity';
import { Color } from './colors/entities/color.entity';
import { Category } from './categories/entities/category.entity';
import { Product } from './products/entities/product.entity';
import { ProductVariant } from './products/entities/product-variant.entity';
import { ProductImage } from './products/entities/product-image.entity';
import { InventoryMovement } from './inventory/entities/inventory-movement.entity';
import { Coupon } from './coupons/entities/coupon.entity';
import { CouponUsage } from './coupons/entities/coupon-usage.entity';
import { Order } from './orders/entities/order.entity';
import { OrderItem } from './orders/entities/order-item.entity';
import { ShippingAddress } from './orders/entities/shipping-address.entity';
import { RefreshToken } from './auth/entities/refresh-token.entity';

dotenv.config({ path: '.env' });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  entities: [
    User,
    Size,
    Color,
    Category,
    Product,
    ProductVariant,
    ProductImage,
    InventoryMovement,
    Coupon,
    CouponUsage,
    Order,
    OrderItem,
    ShippingAddress,
    RefreshToken,
  ],
  migrations: ['src/migration/*.ts'],
  logging: false,
  synchronize: false,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});
