import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { ShippingAddress } from './entities/shipping-address.entity';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { CouponUsage } from '../coupons/entities/coupon-usage.entity';
import { InventoryMovement } from '../inventory/entities/inventory-movement.entity';
import { User } from '../users/entities/user.entity';
import { CouponsService } from '../coupons/coupons.service';
import { CouponsModule } from '../coupons/coupons.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CurrenciesModule } from '../currencies/currencies.module';
import { ProductDeliveryStock } from '../inventory/entities/product-delivery-stock.entity';
import { ProductStoreStock } from '../inventory/entities/product-store-stock.entity';
import { Store } from '../inventory/entities/store.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Order,
      OrderItem,
      ShippingAddress,
      Product,
      ProductVariant,
      Coupon,
      CouponUsage,
      InventoryMovement,
      ProductDeliveryStock,
      ProductStoreStock,
      Store,
      User,
    ]),
    CouponsModule,
    NotificationsModule,
    CurrenciesModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
