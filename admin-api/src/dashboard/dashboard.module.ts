import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrdersModule } from '../orders/orders.module';
import { Order } from '../orders/entities/order.entity';
import { Product } from '../products/entities/product.entity';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Product]), OrdersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}