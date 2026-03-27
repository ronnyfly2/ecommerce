import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Category,
  CategoryAttributeDefinition,
} from '../categories/entities/category.entity';
import { Color } from '../colors/entities/color.entity';
import { Coupon } from '../coupons/entities/coupon.entity';
import { CurrenciesService } from '../currencies/currencies.service';
import { Size } from '../sizes/entities/size.entity';
import { Tag } from '../tags/entities/tag.entity';
import { CreateProductDto } from './dto/create-product.dto';
import { CreateProductImageDto } from './dto/create-product-image.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { QueryProductsDto } from './dto/query-products.dto';
import { UpdateProductImageDto } from './dto/update-product-image.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductVariantDto } from './dto/update-product-variant.dto';
import { ProductImage } from './entities/product-image.entity';
import {
  ProductRecommendation,
  ProductRecommendationType,
} from './entities/product-recommendation.entity';
import { ProductVariant } from './entities/product-variant.entity';
import { Product, ProductAttributeValue } from './entities/product.entity';

@Injectable()
export class ProductsService {
  constructor(
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(ProductImage)
    private readonly imagesRepository: Repository<ProductImage>,
    @InjectRepository(ProductRecommendation)
    private readonly recommendationsRepository: Repository<ProductRecommendation>,
    @InjectRepository(Category)
    private readonly categoriesRepository: Repository<Category>,
    @InjectRepository(Size)
    private readonly sizesRepository: Repository<Size>,
    @InjectRepository(Color)
    private readonly colorsRepository: Repository<Color>,
    @InjectRepository(Coupon)
    private readonly couponsRepository: Repository<Coupon>,
    @InjectRepository(Tag)
    private readonly tagsRepository: Repository<Tag>,
    private readonly currenciesService: CurrenciesService,
  ) {}

  async create(dto: CreateProductDto) {
    const category = await this.categoriesRepository.findOne({
      where: { id: dto.categoryId },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    const normalizedSku = this.normalizeSku(dto.sku);
    await this.ensureProductSkuAvailable(normalizedSku);

    const slug = await this.generateUniqueSlug(dto.name);
    const currencyCode = await this.resolveCurrencyCode(dto.currencyCode);
    const tags = await this.resolveTags(dto.tagIds);
    const coupon = await this.resolveCoupon(dto.couponId);
    const offer = this.normalizeOfferFields(
      dto.basePrice,
      dto.hasOffer,
      dto.offerPrice,
      dto.offerPercentage,
    );

    const product = this.productsRepository.create({
      name: dto.name,
      sku: normalizedSku,
      slug,
      description: dto.description ?? null,
      graphicDescription: dto.graphicDescription?.trim() || null,
      usageMode: dto.usageMode?.trim() || null,
      basePrice: dto.basePrice.toFixed(2),
      currencyCode,
      stock: dto.stock ?? 0,
      weightValue: dto.weightValue !== undefined ? dto.weightValue.toFixed(3) : null,
      weightUnit: dto.weightValue !== undefined ? dto.weightUnit?.trim().toLowerCase() || 'kg' : null,
      lengthValue: dto.lengthValue !== undefined ? dto.lengthValue.toFixed(2) : null,
      widthValue: dto.widthValue !== undefined ? dto.widthValue.toFixed(2) : null,
      heightValue: dto.heightValue !== undefined ? dto.heightValue.toFixed(2) : null,
      dimensionUnit:
        dto.lengthValue !== undefined || dto.widthValue !== undefined || dto.heightValue !== undefined
          ? dto.dimensionUnit?.trim().toLowerCase() || 'cm'
          : null,
      category,
      coupon,
      couponLink: dto.couponLink?.trim() || null,
      isActive: dto.isActive ?? true,
      isFeatured: dto.isFeatured ?? false,
      hasOffer: offer.hasOffer,
      offerPrice: offer.offerPrice,
      offerPercentage: offer.offerPercentage,
      attributeValues: this.normalizeProductAttributeValues(category, dto.attributeValues),
      tags,
    });

    const savedProduct = await this.productsRepository.save(product);

    await this.syncRecommendations(savedProduct.id, {
      relatedProductIds: dto.relatedProductIds,
      suggestedProductIds: dto.suggestedProductIds,
      variantProductIds: dto.variantProductIds,
    });

    return this.findOne(savedProduct.id);
  }

  async findAll(query: QueryProductsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const qb = this.productsRepository
      .createQueryBuilder('product')
      .leftJoinAndSelect('product.category', 'category')
      .leftJoinAndSelect('product.variants', 'variant')
      .leftJoinAndSelect('variant.size', 'size')
      .leftJoinAndSelect('variant.color', 'color')
      .leftJoinAndSelect('product.images', 'image')
      .leftJoinAndSelect('product.coupon', 'coupon')
      .leftJoinAndSelect('product.tags', 'tag')
      .leftJoinAndSelect('product.recommendations', 'recommendation')
      .leftJoinAndSelect('recommendation.recommendedProduct', 'recommendedProduct')
      .leftJoinAndSelect('recommendedProduct.images', 'recommendedProductImage')
      .orderBy('product.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .distinct(true);

    if (query.search) {
      qb.andWhere('(product.name ILIKE :search OR product.sku ILIKE :search)', {
        search: `%${query.search}%`,
      });
    }

    if (query.categoryId) {
      qb.andWhere('product.category_id = :categoryId', { categoryId: query.categoryId });
    }

    if (query.tagId) {
      qb.andWhere('tag.id = :tagId', { tagId: query.tagId });
    }

    if (query.isActive !== undefined) {
      qb.andWhere('product.is_active = :isActive', { isActive: query.isActive });
    }

    if (query.hasOffer !== undefined) {
      qb.andWhere('product.has_offer = :hasOffer', { hasOffer: query.hasOffer });
    }

    if (query.couponId) {
      qb.andWhere('coupon.id = :couponId', { couponId: query.couponId });
    }

    if (query.currencyCode) {
      qb.andWhere('product.currency_code = :currencyCode', {
        currencyCode: this.normalizeCurrencyCode(query.currencyCode),
      });
    }

    const [items, total] = await qb.getManyAndCount();
    const mappedItems = items.map((item) => this.mapProductRecommendations(item));

    return {
      items: mappedItems,
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
        coupon: true,
        tags: true,
        recommendations: {
          recommendedProduct: {
            category: true,
            images: true,
          },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    return this.mapProductRecommendations(product);
  }

  async findRecommendations(id: string) {
    const product = await this.findOne(id);

    return {
      product: {
        id: product.id,
        name: product.name,
        sku: product.sku,
      },
      relatedProducts: product.relatedProducts ?? [],
      suggestedProducts: product.suggestedProducts ?? [],
      variantProducts: product.variantProducts ?? [],
    };
  }

  async update(id: string, dto: UpdateProductDto) {
    const product = await this.findOne(id);

    if (dto.name && dto.name !== product.name) {
      product.name = dto.name;
      product.slug = await this.generateUniqueSlug(dto.name, id);
    }

    if (dto.sku && this.normalizeSku(dto.sku) !== product.sku) {
      const normalizedSku = this.normalizeSku(dto.sku);
      await this.ensureProductSkuAvailable(normalizedSku, id);
      product.sku = normalizedSku;
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

    if (dto.graphicDescription !== undefined) {
      product.graphicDescription = dto.graphicDescription?.trim() || null;
    }

    if (dto.usageMode !== undefined) {
      product.usageMode = dto.usageMode?.trim() || null;
    }

    if (dto.basePrice !== undefined) {
      product.basePrice = dto.basePrice.toFixed(2);
    }

    if (dto.currencyCode !== undefined) {
      product.currencyCode = await this.resolveCurrencyCode(dto.currencyCode);
    }

    if (dto.stock !== undefined) {
      product.stock = dto.stock;
    }

    if (dto.weightValue !== undefined) {
      product.weightValue = dto.weightValue.toFixed(3);
      product.weightUnit = dto.weightUnit?.trim().toLowerCase() || product.weightUnit || 'kg';
    }

    if (dto.weightValue === undefined && dto.weightUnit !== undefined && product.weightValue) {
      product.weightUnit = dto.weightUnit.trim().toLowerCase();
    }

    if (dto.lengthValue !== undefined) {
      product.lengthValue = dto.lengthValue.toFixed(2);
    }

    if (dto.widthValue !== undefined) {
      product.widthValue = dto.widthValue.toFixed(2);
    }

    if (dto.heightValue !== undefined) {
      product.heightValue = dto.heightValue.toFixed(2);
    }

    if (dto.dimensionUnit !== undefined) {
      product.dimensionUnit = dto.dimensionUnit.trim().toLowerCase();
    }

    if (
      dto.lengthValue !== undefined ||
      dto.widthValue !== undefined ||
      dto.heightValue !== undefined
    ) {
      product.dimensionUnit = product.dimensionUnit || dto.dimensionUnit?.trim().toLowerCase() || 'cm';
    }

    if (dto.isActive !== undefined) {
      product.isActive = dto.isActive;
    }

    if (dto.isFeatured !== undefined) {
      product.isFeatured = dto.isFeatured;
    }

    if (dto.tagIds !== undefined) {
      product.tags = await this.resolveTags(dto.tagIds);
    }

    if (dto.couponId !== undefined) {
      product.coupon = await this.resolveCoupon(dto.couponId);
    }

    if (dto.couponLink !== undefined) {
      product.couponLink = dto.couponLink?.trim() || null;
    }

    if (dto.attributeValues !== undefined) {
      product.attributeValues = this.normalizeProductAttributeValues(product.category, dto.attributeValues);
    }

    const nextBasePrice = dto.basePrice !== undefined
      ? dto.basePrice
      : Number(product.basePrice);
    const offer = this.normalizeOfferFields(
      nextBasePrice,
      dto.hasOffer ?? product.hasOffer,
      dto.offerPrice,
      dto.offerPercentage,
      {
        existingOfferPrice: product.offerPrice,
        existingOfferPercentage: product.offerPercentage,
      },
    );

    product.hasOffer = offer.hasOffer;
    product.offerPrice = offer.offerPrice;
    product.offerPercentage = offer.offerPercentage;

    await this.productsRepository.save(product);

    if (dto.relatedProductIds !== undefined || dto.suggestedProductIds !== undefined) {
      await this.syncRecommendations(id, {
        relatedProductIds: dto.relatedProductIds,
        suggestedProductIds: dto.suggestedProductIds,
        variantProductIds: dto.variantProductIds,
      });
    } else if (dto.variantProductIds !== undefined) {
      await this.syncRecommendations(id, {
        variantProductIds: dto.variantProductIds,
      });
    }

    return this.findOne(id);
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

  async createImage(productId: string, dto: CreateProductImageDto) {
    const product = await this.productsRepository.findOne({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const desiredOrder = dto.displayOrder ?? 0;

    if (dto.isMain) {
      await this.imagesRepository.update(
        { product: { id: productId }, isMain: true },
        { isMain: false },
      );
    }

    const image = this.imagesRepository.create({
      product,
      url: dto.url,
      altText: dto.altText ?? null,
      displayOrder: desiredOrder,
      isMain: dto.isMain ?? false,
    });

    return this.imagesRepository.save(image);
  }

  async updateImage(
    productId: string,
    imageId: string,
    dto: UpdateProductImageDto,
  ) {
    const image = await this.imagesRepository.findOne({
      where: { id: imageId, product: { id: productId } },
      relations: { product: true },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    if (dto.url !== undefined) {
      image.url = dto.url;
    }

    if (dto.altText !== undefined) {
      image.altText = dto.altText ?? null;
    }

    if (dto.displayOrder !== undefined) {
      image.displayOrder = dto.displayOrder;
    }

    if (dto.isMain !== undefined) {
      if (dto.isMain) {
        await this.imagesRepository.update(
          { product: { id: productId }, isMain: true },
          { isMain: false },
        );
      }
      image.isMain = dto.isMain;
    }

    return this.imagesRepository.save(image);
  }

  async removeImage(productId: string, imageId: string) {
    const image = await this.imagesRepository.findOne({
      where: { id: imageId, product: { id: productId } },
      relations: { product: true },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    await this.imagesRepository.delete(imageId);
    return { deleted: true };
  }

  private async resolveTags(tagIds?: string[]) {
    if (!tagIds || tagIds.length === 0) {
      return [];
    }

    const uniqueTagIds = [...new Set(tagIds)];
    const tags = await this.tagsRepository.find({
      where: uniqueTagIds.map((id) => ({ id })),
    });

    if (tags.length !== uniqueTagIds.length) {
      throw new NotFoundException('One or more tags were not found');
    }

    return tags;
  }

  private async resolveRecommendationProducts(
    recommendationIds: string[] | undefined,
    currentProductId: string,
    label: 'related' | 'suggested' | 'variant',
  ) {
    if (!recommendationIds || recommendationIds.length === 0) {
      return [];
    }

    const uniqueIds = [...new Set(recommendationIds)];

    if (uniqueIds.some((id) => id === currentProductId)) {
      throw new ConflictException('A product cannot be related to itself');
    }

    const products = await this.productsRepository.find({
      where: uniqueIds.map((id) => ({ id })),
    });

    if (products.length !== uniqueIds.length) {
      throw new NotFoundException(`One or more ${label} products were not found`);
    }

    return uniqueIds;
  }

  private async syncRecommendations(
    productId: string,
    input: { relatedProductIds?: string[]; suggestedProductIds?: string[]; variantProductIds?: string[] },
  ) {
    const existing = await this.recommendationsRepository.find({
      where: { product: { id: productId } },
      relations: { product: true, recommendedProduct: true },
    });

    const nextRelatedIds = input.relatedProductIds !== undefined
      ? await this.resolveRecommendationProducts(input.relatedProductIds, productId, 'related')
      : existing
          .filter((item) => item.type === ProductRecommendationType.RELATED)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((item) => item.recommendedProduct.id);

    const nextSuggestedIds = input.suggestedProductIds !== undefined
      ? await this.resolveRecommendationProducts(input.suggestedProductIds, productId, 'suggested')
      : existing
          .filter((item) => item.type === ProductRecommendationType.SUGGESTED)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((item) => item.recommendedProduct.id);

    const nextVariantIds = input.variantProductIds !== undefined
      ? await this.resolveRecommendationProducts(input.variantProductIds, productId, 'variant')
      : existing
          .filter((item) => item.type === ProductRecommendationType.VARIANT)
          .sort((a, b) => a.displayOrder - b.displayOrder)
          .map((item) => item.recommendedProduct.id);

    await this.recommendationsRepository
      .createQueryBuilder()
      .delete()
      .from(ProductRecommendation)
      .where('product_id = :productId', { productId })
      .execute();

    const rows = [
      ...nextRelatedIds.map((recommendedProductId, index) =>
        this.recommendationsRepository.create({
          product: { id: productId } as Product,
          recommendedProduct: { id: recommendedProductId } as Product,
          type: ProductRecommendationType.RELATED,
          displayOrder: index,
        }),
      ),
      ...nextSuggestedIds.map((recommendedProductId, index) =>
        this.recommendationsRepository.create({
          product: { id: productId } as Product,
          recommendedProduct: { id: recommendedProductId } as Product,
          type: ProductRecommendationType.SUGGESTED,
          displayOrder: index,
        }),
      ),
      ...nextVariantIds.map((recommendedProductId, index) =>
        this.recommendationsRepository.create({
          product: { id: productId } as Product,
          recommendedProduct: { id: recommendedProductId } as Product,
          type: ProductRecommendationType.VARIANT,
          displayOrder: index,
        }),
      ),
    ];

    if (rows.length > 0) {
      await this.recommendationsRepository.save(rows);
    }
  }

  private mapProductRecommendations(product: Product & { recommendations?: ProductRecommendation[] }) {
    const recommendations = product.recommendations ?? [];
    const relatedProducts = recommendations
      .filter((item) => item.type === ProductRecommendationType.RELATED)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => item.recommendedProduct);
    const suggestedProducts = recommendations
      .filter((item) => item.type === ProductRecommendationType.SUGGESTED)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => item.recommendedProduct);
    const variantProducts = recommendations
      .filter((item) => item.type === ProductRecommendationType.VARIANT)
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((item) => item.recommendedProduct);

    return {
      ...product,
      relatedProducts,
      suggestedProducts,
      variantProducts,
    };
  }

  private async resolveCoupon(couponId?: string) {
    if (!couponId) {
      return null;
    }

    const coupon = await this.couponsRepository.findOne({ where: { id: couponId } });
    if (!coupon) {
      throw new NotFoundException('Coupon not found');
    }

    return coupon;
  }

  private normalizeSku(value: string) {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .trim()
      .replace(/[^A-Z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  private normalizeCurrencyCode(code: string) {
    return code.trim().toUpperCase();
  }

  private async resolveCurrencyCode(code?: string) {
    const fallbackCode = await this.currenciesService.getDefaultCurrencyCode();
    const normalized = this.normalizeCurrencyCode(code || fallbackCode);
    const currency = await this.currenciesService.ensureActive(normalized);
    return currency.code;
  }

  private async ensureProductSkuAvailable(sku: string, ignoreId?: string) {
    const existing = await this.productsRepository.findOne({ where: { sku } });

    if (!existing) {
      return;
    }

    if (ignoreId && existing.id === ignoreId) {
      return;
    }

    throw new ConflictException('Product SKU already exists');
  }

  private normalizeOfferFields(
    basePrice: number,
    hasOffer?: boolean,
    offerPrice?: number,
    offerPercentage?: number,
    existing?: { existingOfferPrice: string | null; existingOfferPercentage: string | null },
  ) {
    const enabled = !!hasOffer;
    if (!enabled) {
      return {
        hasOffer: false,
        offerPrice: null,
        offerPercentage: null,
      };
    }

    const resolvedOfferPrice = offerPrice ?? Number(existing?.existingOfferPrice ?? 0);
    const resolvedOfferPercentage = offerPercentage ?? Number(existing?.existingOfferPercentage ?? 0);

    if (offerPrice === undefined && offerPercentage === undefined && !existing?.existingOfferPrice && !existing?.existingOfferPercentage) {
      throw new ConflictException('Offer price or offer percentage is required when offer is active');
    }

    let finalOfferPrice = resolvedOfferPrice;
    let finalOfferPercentage = resolvedOfferPercentage;

    if (offerPrice !== undefined && offerPercentage !== undefined) {
      const expectedOfferPrice = Number((basePrice * (1 - offerPercentage / 100)).toFixed(2));
      if (Math.abs(expectedOfferPrice - offerPrice) > 0.01) {
        throw new ConflictException('Offer price does not match base price and offer percentage');
      }
      finalOfferPrice = offerPrice;
      finalOfferPercentage = offerPercentage;
    } else if (offerPrice !== undefined) {
      finalOfferPercentage = Number((((basePrice - offerPrice) / basePrice) * 100).toFixed(2));
      finalOfferPrice = offerPrice;
    } else if (offerPercentage !== undefined) {
      finalOfferPrice = Number((basePrice * (1 - offerPercentage / 100)).toFixed(2));
      finalOfferPercentage = offerPercentage;
    }

    if (finalOfferPrice < 0 || finalOfferPrice > basePrice) {
      throw new ConflictException('Offer price must be between 0 and base price');
    }

    if (finalOfferPercentage < 0 || finalOfferPercentage > 100) {
      throw new ConflictException('Offer percentage must be between 0 and 100');
    }

    return {
      hasOffer: true,
      offerPrice: finalOfferPrice.toFixed(2),
      offerPercentage: finalOfferPercentage.toFixed(2),
    };
  }

  private normalizeProductAttributeValues(
    category: Category,
    input?: Array<{ key: string; value?: string | number | boolean | null }>,
  ): ProductAttributeValue[] {
    const definitions = (category.attributeDefinitions ?? [])
      .filter((definition) => definition.isActive !== false)
      .sort((left, right) => left.displayOrder - right.displayOrder);

    if (definitions.length === 0) {
      if (input && input.length > 0) {
        throw new ConflictException('Selected category does not define dynamic attributes');
      }
      return [];
    }

    const rawValues = new Map((input ?? []).map((item) => [item.key, item.value]));
    const unknownKeys = [...rawValues.keys()].filter(
      (key) => !definitions.some((definition) => definition.key === key),
    );

    if (unknownKeys.length > 0) {
      throw new ConflictException(`Unknown product attributes: ${unknownKeys.join(', ')}`);
    }

    const normalized: ProductAttributeValue[] = [];

    for (const definition of definitions) {
      const normalizedValue = this.normalizeProductAttributeValue(definition, rawValues.get(definition.key));

      if (normalizedValue === null || normalizedValue === undefined || normalizedValue === '') {
        if (definition.required) {
          throw new ConflictException(`Attribute "${definition.label}" is required`);
        }
        continue;
      }

      normalized.push({
        key: definition.key,
        label: definition.label,
        type: definition.type,
        unit: definition.unit ?? null,
        value: normalizedValue,
      });
    }

    return normalized;
  }

  private normalizeProductAttributeValue(
    definition: CategoryAttributeDefinition,
    rawValue: string | number | boolean | null | undefined,
  ) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      return null;
    }

    if (definition.type === 'boolean') {
      if (typeof rawValue === 'boolean') {
        return rawValue;
      }

      if (rawValue === 'true') {
        return true;
      }

      if (rawValue === 'false') {
        return false;
      }

      throw new ConflictException(`Attribute "${definition.label}" expects a boolean value`);
    }

    if (definition.type === 'number') {
      const numeric = Number(rawValue);
      if (!Number.isFinite(numeric)) {
        throw new ConflictException(`Attribute "${definition.label}" expects a numeric value`);
      }
      return numeric;
    }

    const stringValue = String(rawValue).trim();
    if (!stringValue) {
      return null;
    }

    if (definition.type === 'select' && !definition.options.includes(stringValue)) {
      throw new ConflictException(`Attribute "${definition.label}" has an invalid option`);
    }

    return stringValue;
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
