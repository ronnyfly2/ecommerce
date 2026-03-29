import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { InventoryService } from './inventory.service';
import { InventoryController } from './inventory.controller';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { User } from '../users/entities/user.entity';
import { ProductDeliveryStock } from './entities/product-delivery-stock.entity';
import { ProductStoreStock } from './entities/product-store-stock.entity';
import { Store } from './entities/store.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      InventoryMovement,
      Product,
      ProductVariant,
      User,
      ProductDeliveryStock,
      ProductStoreStock,
      Store,
    ]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService],
})
export class InventoryModule {}
