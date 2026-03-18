import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, Repository } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Color } from '../colors/entities/color.entity';
import { Size } from '../sizes/entities/size.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { ProductImage } from './entities/product-image.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Product } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(ProductImage)
    private readonly imagesRepository: Repository<ProductImage>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Size)
    private readonly sizesRepository: Repository<Size>,
    @InjectRepository(Color)
    private readonly colorsRepository: Repository<Color>,
  ) {}

  async create(dto: CreateProductDto) {
    const category = await this.categoriesRepository.findOne({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const slug = await this.generateUniqueSlug(dto.name);

    const product = this.productsRepository.create({
      name: dto.name,
      slug,
      description: dto.description ?? null,
      basePrice: dto.basePrice.toFixed(2),
      category,
      isActive: dto.isActive ?? true,
      isFeatured: dto.isFeatured ?? false,
    });

    return this.productsRepository.save(product);
  }

  async findAll(query: QueryProductsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<Product> = {};

    if (query.search) {
      where.name = ILike(`%${query.search}%`);
    }

    if (query.categoryId) {
      where.category = { id: query.categoryId } as Category;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    const [items, total] = await this.productsRepository.findAndCount({
      where,
      relations: {
        category: true,
        variants: {
          size: true,
          color: true,
        },
        images: true,
      },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const product = await this.productsRepository.findOne({
      where: { id },
      relations: {
        category: true,
        variants: {
          size: true,
          color: true,
        },
        images: true,
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return product;
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findOne(id);

    if (dto.name && dto.name !== product.name) {
      product.name = dto.name;
      product.slug = await this.generateUniqueSlug(dto.name, id);
    }

    if (dto.categoryId) {
      const category = await this.categoriesRepository.findOne({
        where: { id: dto.categoryId },
      });

      if (!category) {
        throw new NotFoundException('Category not found');
      }

      product.category = category;
    }

    if (dto.description !== undefined) {
      product.description = dto.description ?? null;
    }

    if (dto.basePrice !== undefined) {
      product.basePrice = dto.basePrice.toFixed(2);
    }

    if (dto.isActive !== undefined) {
      product.isActive = dto.isActive;
    }

    if (dto.isFeatured !== undefined) {
      product.isFeatured = dto.isFeatured;
    }

    return this.productsRepository.save(product);
  }

  async remove(id: string) {
    await this.findOne(id);
    await this.productsRepository.delete(id);
    return { deleted: true };
  }

  async getVariants(productId: string) {
    await this.findOne(productId);

    return this.variantsRepository.find({
      where: { product: { id: productId } },
      relations: { size: true, color: true },
      order: { createdAt: 'DESC' },
    });
  }

  async createVariant(productId: string, dto: CreateProductVariantDto) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const skuExists = await this.variantsRepository.findOne({ where: { sku: dto.sku } });
    if (skuExists) {
      throw new ConflictException('SKU already exists');
    }

    const size = await this.sizesRepository.findOne({ where: { id: dto.sizeId } });
    if (!size) {
      throw new NotFoundException('Size not found');
    }

    const color = await this.colorsRepository.findOne({ where: { id: dto.colorId } });
    if (!color) {
      throw new NotFoundException('Color not found');
    }

    const variant = this.variantsRepository.create({
      product,
      sku: dto.sku,
      size,
      color,
      stock: dto.stock,
      additionalPrice: (dto.additionalPrice ?? 0).toFixed(2),
      isActive: dto.isActive ?? true,
    });

    return this.variantsRepository.save(variant);
  }

  async updateVariant(productId: string, variantId: string, dto: UpdateProductVariantDto) {
    const variant = await this.variantsRepository.findOne({
      where: { id: variantId, product: { id: productId } },
      relations: { product: true, size: true, color: true },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    if (dto.sku && dto.sku !== variant.sku) {
      const skuExists = await this.variantsRepository.findOne({ where: { sku: dto.sku } });
      if (skuExists && skuExists.id !== variant.id) {
        throw new ConflictException('SKU already exists');
      }
      variant.sku = dto.sku;
    }

    if (dto.sizeId) {
      const size = await this.sizesRepository.findOne({ where: { id: dto.sizeId } });
      if (!size) {
        throw new NotFoundException('Size not found');
      }
      variant.size = size;
    }

    if (dto.colorId) {
      const color = await this.colorsRepository.findOne({ where: { id: dto.colorId } });
      if (!color) {
        throw new NotFoundException('Color not found');
      }
      variant.color = color;
    }

    if (dto.stock !== undefined) {
      variant.stock = dto.stock;
    }

    if (dto.additionalPrice !== undefined) {
      variant.additionalPrice = dto.additionalPrice.toFixed(2);
    }

    if (dto.isActive !== undefined) {
      variant.isActive = dto.isActive;
    }

    return this.variantsRepository.save(variant);
  }

  async removeVariant(productId: string, variantId: string) {
    const variant = await this.variantsRepository.findOne({
      where: { id: variantId, product: { id: productId } },
    });

    if (!variant) {
      throw new NotFoundException('Variant not found');
    }

    await this.variantsRepository.delete(variantId);
    return { deleted: true };
  }

  private async generateUniqueSlug(name: string, ignoreId?: string): Promise<string> {
    const baseSlug = this.slugify(name);
    let slug = baseSlug;
    let suffix = 1;

    while (await this.slugExists(slug, ignoreId)) {
      slug = `${baseSlug}-${suffix}`;
      suffix += 1;
    }

    return slug;
  }

  private async slugExists(slug: string, ignoreId?: string): Promise<boolean> {
    const product = await this.productsRepository.findOne({ where: { slug } });

    if (!product) {
      return false;
    }

    if (ignoreId && product.id === ignoreId) {
      return false;
    }

    return true;
  }

  private slugify(input: string): string {
    return input
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
}
