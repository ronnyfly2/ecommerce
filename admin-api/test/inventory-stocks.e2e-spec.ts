import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { App } from 'supertest/types';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';
import { User } from '../src/users/entities/user.entity';
import { Category } from '../src/categories/entities/category.entity';
import { Product } from '../src/products/entities/product.entity';
import { Store } from '../src/inventory/entities/store.entity';
import { ProductDeliveryStock } from '../src/inventory/entities/product-delivery-stock.entity';
import { ProductStoreStock } from '../src/inventory/entities/product-store-stock.entity';

jest.setTimeout(120000);

describe('Inventory Stocks (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let categoriesRepository: Repository<Category>;
  let productsRepository: Repository<Product>;
  let storesRepository: Repository<Store>;
  let deliveryStocksRepository: Repository<ProductDeliveryStock>;
  let storeStocksRepository: Repository<ProductStoreStock>;

  const trackedUserEmails = new Set<string>();
  const trackedProductIds = new Set<string>();
  const trackedCategoryIds = new Set<string>();
  const trackedStoreIds = new Set<string>();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new TransformInterceptor());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    await app.init();

    usersRepository = moduleFixture.get(getRepositoryToken(User));
    categoriesRepository = moduleFixture.get(getRepositoryToken(Category));
    productsRepository = moduleFixture.get(getRepositoryToken(Product));
    storesRepository = moduleFixture.get(getRepositoryToken(Store));
    deliveryStocksRepository = moduleFixture.get(getRepositoryToken(ProductDeliveryStock));
    storeStocksRepository = moduleFixture.get(getRepositoryToken(ProductStoreStock));
  });

  afterEach(async () => {
    await cleanupTrackedData();
    jest.restoreAllMocks();
  });

  afterAll(async () => {
    await cleanupTrackedData();
    if (app) {
      await app.close();
    }
  });

  it('returns 200 with paginated stock data', async () => {
    const admin = await createAndLoginAdmin();
    const store = await ensureStore('ATE');
    await createProductWithStocks({
      skuSuffix: 'BASE',
      deliveryStock: 7,
      pickupByStoreId: { [store.id]: 3 },
    });

    await request(app.getHttpServer())
      .get('/api/inventory/stocks?page=1&limit=20&lowStockThreshold=5')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body.data.items)).toBe(true);
        expect(body.data.meta).toBeDefined();
        expect(body.data.meta.page).toBe(1);
        expect(body.data.meta.limit).toBe(20);
        expect(body.data.items.length).toBeGreaterThan(0);
      });
  });

  it('filters products by storeId', async () => {
    const admin = await createAndLoginAdmin();
    const storeAte = await ensureStore('ATE_FILTER');
    const storeLince = await ensureStore('LINCE_FILTER');

    const productOnlyAte = await createProductWithStocks({
      skuSuffix: 'ONLYATE',
      deliveryStock: 2,
      pickupByStoreId: { [storeAte.id]: 5 },
    });

    await createProductWithStocks({
      skuSuffix: 'ONLYLINCE',
      deliveryStock: 2,
      pickupByStoreId: { [storeLince.id]: 5 },
    });

    await request(app.getHttpServer())
      .get(`/api/inventory/stocks?page=1&limit=50&storeId=${storeAte.id}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        const ids = body.data.items.map((item: { productId: string }) => item.productId);
        expect(ids).toContain(productOnlyAte.id);
        expect(ids.length).toBe(1);
      });
  });

  it('does not crash when stock rows contain missing relations (regression)', async () => {
    const admin = await createAndLoginAdmin();
    const store = await ensureStore('REG');
    await createProductWithStocks({
      skuSuffix: 'REGRESSION',
      deliveryStock: 4,
      pickupByStoreId: { [store.id]: 1 },
    });

    const originalFind = deliveryStocksRepository.find.bind(deliveryStocksRepository);
    jest.spyOn(deliveryStocksRepository, 'find').mockImplementation(async (options) => {
      const rows = await originalFind(options as never);
      return [
        ...rows,
        { id: 'orphan-row', stock: 99, product: undefined } as unknown as ProductDeliveryStock,
      ];
    });

    await request(app.getHttpServer())
      .get('/api/inventory/stocks?page=1&limit=20')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body.data.items)).toBe(true);
        expect(body.data.meta.total).toBeGreaterThan(0);
      });
  });

  async function createAndLoginAdmin() {
    const email = `e2e.inv.admin.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
    trackedUserEmails.add(email);

    const admin = usersRepository.create({
      email,
      passwordHash: await bcrypt.hash('StrongPass123!', 10),
      firstName: 'E2E',
      lastName: 'Inventory',
      role: Role.ADMIN,
      isActive: true,
      avatar: null,
    });
    await usersRepository.save(admin);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: 'StrongPass123!' })
      .expect(201);

    return {
      accessToken: response.body.data.accessToken as string,
    };
  }

  async function ensureStore(codePrefix: string) {
    const store = await storesRepository.save(
      storesRepository.create({
        code: `${codePrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name: `Store ${codePrefix}`,
        city: 'Lima',
        country: 'Peru',
        address: `${codePrefix} Street`,
        isActive: true,
      }),
    );
    trackedStoreIds.add(store.id);
    return store;
  }

  async function createProductWithStocks(params: {
    skuSuffix: string;
    deliveryStock: number;
    pickupByStoreId: Record<string, number>;
  }) {
    const category = await categoriesRepository.save(
      categoriesRepository.create({
        name: `E2E Inv Cat ${Date.now()} ${Math.random().toString(36).slice(2)}`,
        slug: `e2e-inv-cat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: null,
        image: null,
        isActive: true,
        displayOrder: 0,
        supportsSizeColorVariants: false,
        supportsDimensions: false,
        supportsWeight: false,
        attributeDefinitions: [],
        parent: null,
        children: [],
      }),
    );
    trackedCategoryIds.add(category.id);

    const product = await productsRepository.save(
      productsRepository.create({
        name: `E2E Inv Product ${params.skuSuffix} ${Date.now()}`,
        sku: `E2E-INV-${params.skuSuffix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        slug: `e2e-inv-product-${params.skuSuffix.toLowerCase()}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        description: null,
        graphicDescription: null,
        usageMode: null,
        basePrice: '10.00',
        currencyCode: 'USD',
        stock: params.deliveryStock + Object.values(params.pickupByStoreId).reduce((a, b) => a + b, 0),
        weightValue: null,
        weightUnit: null,
        lengthValue: null,
        widthValue: null,
        heightValue: null,
        dimensionUnit: null,
        attributeValues: [],
        category,
        coupon: null,
        couponLink: null,
        isActive: true,
        isFeatured: false,
        hasOffer: false,
        offerPrice: null,
        offerPercentage: null,
        tags: [],
        recommendations: [],
        variants: [],
        images: [],
      }),
    );
    trackedProductIds.add(product.id);

    await deliveryStocksRepository.save(
      deliveryStocksRepository.create({
        product,
        stock: params.deliveryStock,
      }),
    );

    for (const [storeId, stock] of Object.entries(params.pickupByStoreId)) {
      await storeStocksRepository.save(
        storeStocksRepository.create({
          product,
          store: { id: storeId } as Store,
          stock,
        }),
      );
    }

    return product;
  }

  async function cleanupTrackedData() {
    if (trackedProductIds.size) {
      await productsRepository.delete({ id: In([...trackedProductIds]) });
      trackedProductIds.clear();
    }

    if (trackedCategoryIds.size) {
      await categoriesRepository.delete({ id: In([...trackedCategoryIds]) });
      trackedCategoryIds.clear();
    }

    if (trackedUserEmails.size) {
      await usersRepository.delete({ email: In([...trackedUserEmails]) });
      trackedUserEmails.clear();
    }

    if (trackedStoreIds.size) {
      await storesRepository.delete({ id: In([...trackedStoreIds]) });
      trackedStoreIds.clear();
    }
  }
});
