import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Size } from '../sizes/entities/size.entity';
import { Color } from '../colors/entities/color.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Product } from '../products/entities/product.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { Currency } from '../currencies/entities/currency.entity';
import { Category } from '../categories/entities/category.entity';
import { Tag } from '../tags/entities/tag.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { CouponUsage } from '../coupons/entities/coupon-usage.entity';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { ShippingAddress } from '../orders/entities/shipping-address.entity';
import { Carrier } from '../shipments/entities/carrier.entity';
import { Shipment } from '../shipments/entities/shipment.entity';
import { ShipmentItem } from '../shipments/entities/shipment-item.entity';
import { ShipmentEvent } from '../shipments/entities/shipment-event.entity';
import { Notification } from '../notifications/entities/notification.entity';
import { AdminToolsController } from './admin-tools.controller';
import { AdminToolsService } from './admin-tools.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Size,
      Color,
      Currency,
      Category,
      Tag,
      Product,
      ProductImage,
      ProductVariant,
      Coupon,
      CouponUsage,
      Order,
      OrderItem,
      ShippingAddress,
      Carrier,
      Shipment,
      ShipmentItem,
      ShipmentEvent,
      Notification,
    ]),
  ],
  controllers: [AdminToolsController],
  providers: [AdminToolsService],
})
export class AdminToolsModule {}
