import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Category } from '../categories/entities/category.entity';
import { Color } from '../colors/entities/color.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { CurrenciesModule } from '../currencies/currencies.module';
import { Size } from '../sizes/entities/size.entity';
import { Tag } from '../tags/entities/tag.entity';
import { ProductImage } from './entities/product-image.entity';
import { ProductRecommendation } from './entities/product-recommendation.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Product } from './entities/product.entity';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Product,
      ProductRecommendation,
      ProductVariant,
      ProductImage,
      Category,
      Size,
      Color,
      Coupon,
      Tag,
    ]),
    CurrenciesModule,
  ],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
