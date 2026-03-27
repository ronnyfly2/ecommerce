import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Size } from '../sizes/entities/size.entity';
import { Color } from '../colors/entities/color.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { Currency } from '../currencies/entities/currency.entity';
import { AdminToolsController } from './admin-tools.controller';
import { AdminToolsService } from './admin-tools.service';

@Module({
  imports: [TypeOrmModule.forFeature([User, Size, Color, Currency, ProductVariant])],
  controllers: [AdminToolsController],
  providers: [AdminToolsService],
})
export class AdminToolsModule {}
