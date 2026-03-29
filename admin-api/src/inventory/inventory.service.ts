import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, ILike, In, Repository } from 'typeorm';
import { CreateInventoryAdjustmentDto } from './dto/create-inventory-adjustment.dto';
import { QueryInventoryMovementsDto } from './dto/query-inventory-movements.dto';
import { UpsertProductStockDto } from './dto/upsert-product-stock.dto';
import { QueryProductStocksDto } from './dto/query-product-stocks.dto';
import { BulkUpsertProductStocksDto } from './dto/bulk-upsert-product-stocks.dto';
import { CreateStoreDto } from './dto/create-store.dto';
import { UpdateStoreDto } from './dto/update-store.dto';
import { InventoryMovement } from './entities/inventory-movement.entity';
import { Product } from '../products/entities/product.entity';
import { ProductVariant } from '../products/entities/product-variant.entity';
import { User } from '../users/entities/user.entity';
import { ProductDeliveryStock } from './entities/product-delivery-stock.entity';
import { ProductStoreStock } from './entities/product-store-stock.entity';
import { Store } from './entities/store.entity';
import { InventoryChannel } from './enums/inventory-channel.enum';
import { InventoryMovementType } from './enums/inventory-movement-type.enum';

@Injectable()
export class InventoryService {
  constructor(
    @InjectRepository(InventoryMovement)
    private readonly movementsRepository: Repository<InventoryMovement>,
    @InjectRepository(Product)
    private readonly productsRepository: Repository<Product>,
    @InjectRepository(ProductVariant)
    private readonly variantsRepository: Repository<ProductVariant>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(ProductDeliveryStock)
    private readonly deliveryStocksRepository: Repository<ProductDeliveryStock>,
    @InjectRepository(ProductStoreStock)
    private readonly storeStocksRepository: Repository<ProductStoreStock>,
    @InjectRepository(Store)
    private readonly storesRepository: Repository<Store>,
  ) {}

  async createMovement(
    dto: CreateInventoryAdjustmentDto,
    userId: string,
  ) {
    if (!dto.productId && !dto.variantId) {
      throw new NotFoundException('Product or variant is required');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    let product: Product | null = null;
    let variant: ProductVariant | null = null;
    const store = dto.storeId
      ? await this.storesRepository.findOne({ where: { id: dto.storeId, isActive: true } })
      : null;

    if (dto.storeId && !store) {
      throw new NotFoundException('Store not found');
    }

    if (dto.channelType === InventoryChannel.PICKUP && !store) {
      throw new BadRequestException('storeId is required for pickup movements');
    }

    if (dto.channelType === InventoryChannel.DELIVERY && store) {
      throw new BadRequestException('storeId must be omitted for delivery movements');
    }

    if (dto.productId) {
      product = await this.productsRepository.findOne({ where: { id: dto.productId } });

      if (!product) {
        throw new NotFoundException('Product not found');
      }

      product.stock += dto.quantityChange;
      await this.productsRepository.save(product);

      if (dto.channelType === InventoryChannel.DELIVERY) {
        const deliveryStock = await this.ensureDeliveryStock(product);
        deliveryStock.stock += dto.quantityChange;
        await this.deliveryStocksRepository.save(deliveryStock);
      }

      if (dto.channelType === InventoryChannel.PICKUP && store) {
        const pickupStock = await this.ensureStoreStock(product, store);
        pickupStock.stock += dto.quantityChange;
        await this.storeStocksRepository.save(pickupStock);
      }
    } else if (dto.variantId) {
      variant = await this.variantsRepository.findOne({
        where: { id: dto.variantId },
        relations: { product: true },
      });

      if (!variant) {
        throw new NotFoundException('Variant not found');
      }

      variant.stock += dto.quantityChange;
      await this.variantsRepository.save(variant);

      product = variant.product;
      if (product) {
        product.stock += dto.quantityChange;
        await this.productsRepository.save(product);

        if (dto.channelType === InventoryChannel.DELIVERY) {
          const deliveryStock = await this.ensureDeliveryStock(product);
          deliveryStock.stock += dto.quantityChange;
          await this.deliveryStocksRepository.save(deliveryStock);
        }

        if (dto.channelType === InventoryChannel.PICKUP && store) {
          const pickupStock = await this.ensureStoreStock(product, store);
          pickupStock.stock += dto.quantityChange;
          await this.storeStocksRepository.save(pickupStock);
        }
      }
    }

    const movement = this.movementsRepository.create({
      product,
      variant,
      quantityChange: dto.quantityChange,
      type: dto.type,
      reason: dto.reason ?? null,
      channelType: dto.channelType ?? null,
      store,
      createdBy: user,
    });

    if (product) {
      await this.recalculateAndPersistProductStock(product);
    }

    return this.movementsRepository.save(movement);
  }

  async listStores() {
    return this.storesRepository.find({
      where: { isActive: true },
      order: { code: 'ASC' },
    });
  }

  async getProductStock(productId: string) {
    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    const [deliveryStock, pickupStocks, stores] = await Promise.all([
      this.deliveryStocksRepository.findOne({ where: { product: { id: productId } } }),
      this.storeStocksRepository.find({
        where: { product: { id: productId } },
        relations: { store: true },
      }),
      this.storesRepository.find({ where: { isActive: true }, order: { code: 'ASC' } }),
    ]);

    const pickupByStore = new Map(pickupStocks.map((item) => [item.store.id, item.stock]));

    const pickupItems = stores.map((store) => ({
      storeId: store.id,
      storeCode: store.code,
      storeName: store.name,
      stock: pickupByStore.get(store.id) ?? 0,
    }));

    const totalStock = (deliveryStock?.stock ?? 0) + pickupItems.reduce((sum, item) => sum + item.stock, 0);

    return {
      productId: product.id,
      sku: product.sku,
      deliveryStock: deliveryStock?.stock ?? 0,
      pickupStocks: pickupItems,
      totalStock,
    };
  }

  async upsertProductStock(productId: string, dto: UpsertProductStockDto, userId: string) {
    if (dto.deliveryStock === undefined && !dto.pickupStocks?.length) {
      throw new BadRequestException('deliveryStock or pickupStocks is required');
    }

    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const product = await this.productsRepository.findOne({ where: { id: productId } });
    if (!product) {
      throw new NotFoundException('Product not found');
    }

    if (dto.deliveryStock !== undefined) {
      const deliveryStock = await this.ensureDeliveryStock(product);
      const quantityChange = dto.deliveryStock - deliveryStock.stock;
      deliveryStock.stock = dto.deliveryStock;
      await this.deliveryStocksRepository.save(deliveryStock);

      if (quantityChange !== 0) {
        await this.movementsRepository.save(
          this.movementsRepository.create({
            product,
            variant: null,
            quantityChange,
            reason: 'Delivery stock update',
            type: quantityChange > 0
              ? InventoryMovementType.PURCHASE
              : InventoryMovementType.ADJUSTMENT,
            channelType: InventoryChannel.DELIVERY,
            store: null,
            createdBy: user,
          }),
        );
      }
    }

    if (dto.pickupStocks?.length) {
      for (const pickup of dto.pickupStocks) {
        const store = await this.storesRepository.findOne({
          where: { id: pickup.storeId, isActive: true },
        });
        if (!store) {
          throw new NotFoundException(`Store ${pickup.storeId} not found`);
        }

        const pickupStock = await this.ensureStoreStock(product, store);
        const quantityChange = pickup.stock - pickupStock.stock;
        pickupStock.stock = pickup.stock;
        await this.storeStocksRepository.save(pickupStock);

        if (quantityChange !== 0) {
          await this.movementsRepository.save(
            this.movementsRepository.create({
              product,
              variant: null,
              quantityChange,
              reason: 'Pickup stock update',
              type: quantityChange > 0
                ? InventoryMovementType.PURCHASE
                : InventoryMovementType.ADJUSTMENT,
              channelType: InventoryChannel.PICKUP,
              store,
              createdBy: user,
            }),
          );
        }
      }
    }

    await this.recalculateAndPersistProductStock(product);
    return this.getProductStock(productId);
  }

  async listProductStocks(query: QueryProductStocksDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    const skip = (page - 1) * limit;
    const threshold = query.lowStockThreshold ?? 5;

    // If storeId filter provided, scope to products that have a stock record for that store
    let productIdFilter: string[] | undefined;
    if (query.storeId) {
      const storeStockEntries = await this.storeStocksRepository.find({
        where: { store: { id: query.storeId } },
        relations: { product: true },
      });
      productIdFilter = storeStockEntries.map((e) => e.product.id);
    }

    const buildWhere = (): FindOptionsWhere<Product>[] | FindOptionsWhere<Product> | undefined => {
      const idFilter: FindOptionsWhere<Product> | undefined = productIdFilter
        ? { id: In(productIdFilter) }
        : undefined;

      if (query.search) {
        return [
          { ...idFilter, name: ILike(`%${query.search}%`) },
          { ...idFilter, sku: ILike(`%${query.search}%`) },
        ];
      }
      return idFilter;
    };

    const where = buildWhere();

    const [products, total, stores] = await Promise.all([
      this.productsRepository.find({
        where,
        order: { createdAt: 'DESC' },
        skip,
        take: limit,
      }),
      this.productsRepository.count({ where }),
      this.storesRepository.find({ where: { isActive: true }, order: { code: 'ASC' } }),
    ]);

    if (!products.length) {
      return {
        items: [],
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const productIds = products.map((product) => product.id);
    const [deliveryStocks, pickupStocks] = await Promise.all([
      this.deliveryStocksRepository.find({
        where: { product: { id: In(productIds) } },
        relations: { product: true },
      }),
      this.storeStocksRepository.find({
        where: { product: { id: In(productIds) } },
        relations: { store: true, product: true },
      }),
    ]);

    const deliveryByProduct = new Map(
      deliveryStocks
        .filter((item) => item.product?.id)
        .map((item) => [item.product.id, item.stock]),
    );
    const pickupByProductAndStore = new Map(
      pickupStocks
        .filter((item) => item.product?.id && item.store?.id)
        .map((item) => [`${item.product.id}:${item.store.id}`, item.stock]),
    );

    const items = products.map((product) => {
      const deliveryStock = deliveryByProduct.get(product.id) ?? 0;
      const pickupItems = stores.map((store) => ({
        storeId: store.id,
        storeCode: store.code,
        storeName: store.name,
        stock: pickupByProductAndStore.get(`${product.id}:${store.id}`) ?? 0,
      }));
      const totalStock = deliveryStock + pickupItems.reduce((sum, item) => sum + item.stock, 0);

      return {
        productId: product.id,
        productName: product.name,
        sku: product.sku,
        deliveryStock,
        pickupStocks: pickupItems,
        totalStock,
        alerts: {
          lowDelivery: deliveryStock <= threshold,
          lowPickupStoreIds: pickupItems
            .filter((item) => item.stock <= threshold)
            .map((item) => item.storeId),
        },
      };
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

  async bulkUpsertProductStocks(dto: BulkUpsertProductStocksDto, userId: string) {
    const results = [] as Array<Awaited<ReturnType<InventoryService['getProductStock']>>>;

    for (const item of dto.items) {
      const result = await this.upsertProductStock(
        item.productId,
        {
          deliveryStock: item.deliveryStock,
          pickupStocks: item.pickupStocks,
        },
        userId,
      );
      results.push(result);
    }

    return {
      totalUpdated: results.length,
      items: results,
    };
  }

  async findMovements(query: QueryInventoryMovementsDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 10, 100);
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<InventoryMovement> = {};
    if (query.variantId) {
      where.variant = { id: query.variantId } as ProductVariant;
    }
    if (query.productId) {
      where.product = { id: query.productId } as Product;
    }

    const [items, total] = await this.movementsRepository.findAndCount({
      where,
      relations: {
        product: true,
        variant: { product: true, size: true, color: true },
        store: true,
        createdBy: true,
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

  private async ensureDeliveryStock(product: Product) {
    const existing = await this.deliveryStocksRepository.findOne({
      where: { product: { id: product.id } },
      relations: { product: true },
    });

    if (existing) {
      return existing;
    }

    return this.deliveryStocksRepository.create({
      product,
      stock: 0,
    });
  }

  private async ensureStoreStock(product: Product, store: Store) {
    const existing = await this.storeStocksRepository.findOne({
      where: {
        product: { id: product.id },
        store: { id: store.id },
      },
      relations: { product: true, store: true },
    });

    if (existing) {
      return existing;
    }

    return this.storeStocksRepository.create({
      product,
      store,
      stock: 0,
    });
  }

  private async recalculateAndPersistProductStock(product: Product) {
    const [deliveryStock, storeStocks] = await Promise.all([
      this.deliveryStocksRepository.findOne({ where: { product: { id: product.id } } }),
      this.storeStocksRepository.find({ where: { product: { id: product.id } } }),
    ]);

    const nextStock = (deliveryStock?.stock ?? 0)
      + storeStocks.reduce((sum, item) => sum + item.stock, 0);

    if (product.stock !== nextStock) {
      product.stock = nextStock;
      await this.productsRepository.save(product);
    }
  }

  // ── Store management ────────────────────────────────────────────────────────

  async createStore(dto: CreateStoreDto) {
    const exists = await this.storesRepository.findOne({ where: { code: dto.code } });
    if (exists) {
      throw new ConflictException(`A store with code "${dto.code}" already exists`);
    }
    const store = this.storesRepository.create({
      code: dto.code.toUpperCase(),
      name: dto.name,
      city: dto.city,
      country: dto.country,
      address: dto.address ?? null,
      isActive: dto.isActive ?? true,
    });
    return this.storesRepository.save(store);
  }

  async updateStore(id: string, dto: UpdateStoreDto) {
    const store = await this.storesRepository.findOne({ where: { id } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    if (dto.code && dto.code !== store.code) {
      const conflict = await this.storesRepository.findOne({ where: { code: dto.code } });
      if (conflict) {
        throw new ConflictException(`A store with code "${dto.code}" already exists`);
      }
      store.code = dto.code.toUpperCase();
    }
    if (dto.name !== undefined) store.name = dto.name;
    if (dto.city !== undefined) store.city = dto.city;
    if (dto.country !== undefined) store.country = dto.country;
    if (dto.address !== undefined) store.address = dto.address ?? null;
    if (dto.isActive !== undefined) store.isActive = dto.isActive;
    return this.storesRepository.save(store);
  }

  async deleteStore(id: string) {
    const store = await this.storesRepository.findOne({ where: { id } });
    if (!store) {
      throw new NotFoundException('Store not found');
    }
    await this.storesRepository.remove(store);
  }

  async allStores() {
    return this.storesRepository.find({ order: { code: 'ASC' } });
  }
}
