import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../orders/entities/order.entity';
import { OrderItem } from '../orders/entities/order-item.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Carrier } from './entities/carrier.entity';
import { Shipment } from './entities/shipment.entity';
import { ShipmentEvent } from './entities/shipment-event.entity';
import { ShipmentItem } from './entities/shipment-item.entity';
import { CarriersController } from './carriers.controller';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Shipment,
      ShipmentItem,
      ShipmentEvent,
      Carrier,
      Order,
      OrderItem,
    ]),
    NotificationsModule,
  ],
  controllers: [ShipmentsController, CarriersController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
