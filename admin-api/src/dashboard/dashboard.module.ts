import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../orders/orders.module';
import { Order } from '../orders/entities/order.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, ProductVariant]), OrdersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}