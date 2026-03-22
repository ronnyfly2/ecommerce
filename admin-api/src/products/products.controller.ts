import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  PRODUCT_MANAGE_ROLES,
  PRODUCT_READ_ROLES,
} from '../common/auth/role-groups';
import { Roles } from '../common/decorators/roles.decorator';
import { Public } from '../common/decorators/public.decorator';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { ProductsService } from './products.service';

@ApiTags('Products')
@ApiBearerAuth()
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Roles(...PRODUCT_MANAGE_ROLES)
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Roles(...PRODUCT_READ_ROLES)
  @Get()
  findAll(@Query() query: QueryProductsDto) {
    return this.productsService.findAll(query);
  }

  @Public()
  @Roles()
  @Get(':id/recommendations')
  findRecommendations(@Param('id') id: string) {
    return this.productsService.findRecommendations(id);
  }

  @Roles(...PRODUCT_READ_ROLES)
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Roles(...PRODUCT_MANAGE_ROLES)
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Roles(...PRODUCT_MANAGE_ROLES)
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Roles(...PRODUCT_READ_ROLES)
  @Get(':id/variants')
  getVariants(@Param('id') id: string) {
    return this.productsService.getVariants(id);
  }

  @Roles(...PRODUCT_MANAGE_ROLES)
  @Post(':id/variants')
  createVariant(
    @Param('id') id: string,
    @Body() dto: CreateProductVariantDto,
  ) {
    return this.productsService.createVariant(id, dto);
  }

  @Roles(...PRODUCT_MANAGE_ROLES)
  @Patch(':id/variants/:variantId')
  updateVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
    @Body() dto: UpdateProductVariantDto,
  ) {
    return this.productsService.updateVariant(id, variantId, dto);
  }

  @Roles(...PRODUCT_MANAGE_ROLES)
  @Delete(':id/variants/:variantId')
  removeVariant(
    @Param('id') id: string,
    @Param('variantId') variantId: string,
  ) {
    return this.productsService.removeVariant(id, variantId);
  }

  @Roles(...PRODUCT_MANAGE_ROLES)
  @Post(':id/images')
  createImage(@Param('id') id: string, @Body() dto: CreateProductImageDto) {
    return this.productsService.createImage(id, dto);
  }

  @Roles(...PRODUCT_MANAGE_ROLES)
  @Patch(':id/images/:imageId')
  updateImage(
    @Param('id') id: string,
    @Param('imageId') imageId: string,
    @Body() dto: UpdateProductImageDto,
  ) {
    return this.productsService.updateImage(id, imageId, dto);
  }

  @Roles(...PRODUCT_MANAGE_ROLES)
  @Delete(':id/images/:imageId')
  removeImage(@Param('id') id: string, @Param('imageId') imageId: string) {
    return this.productsService.removeImage(id, imageId);
  }
}
