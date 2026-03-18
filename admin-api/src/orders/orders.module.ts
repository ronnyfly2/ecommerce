import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ShippingAddress } from './entities/shipping-address.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { CouponUsage } from '../coupons/entities/coupon-usage.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { User } from '../users/entities/user.entity';
import { CouponsService } from '../coupons/coupons.service';
import { CouponsModule } from '../coupons/coupons.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      ShippingAddress,
      ProductVariant,
      Coupon,
      CouponUsage,
      InventoryMovement,
      User,
    ]),
    CouponsModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
