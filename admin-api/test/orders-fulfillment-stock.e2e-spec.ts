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
import { Order } from '../src/orders/entities/order.entity';
import { InventoryMovement } from '../src/inventory/entities/inventory-movement.entity';

jest.setTimeout(120000);

describe('Orders Fulfillment Stock (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let categoriesRepository: Repository<Category>;
  let productsRepository: Repository<Product>;
  let storesRepository: Repository<Store>;
  let deliveryStocksRepository: Repository<ProductDeliveryStock>;
  let storeStocksRepository: Repository<ProductStoreStock>;
  let ordersRepository: Repository<Order>;
  let inventoryMovementsRepository: Repository<InventoryMovement>;

  const trackedUserEmails = new Set<string>();
  const trackedProductIds = new Set<string>();
  const trackedCategoryIds = new Set<string>();
  const trackedOrderIds = new Set<string>();
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
    ordersRepository = moduleFixture.get(getRepositoryToken(Order));
    inventoryMovementsRepository = moduleFixture.get(getRepositoryToken(InventoryMovement));
  });

  afterEach(async () => {
    await cleanupTrackedData();
  });

  afterAll(async () => {
    await cleanupTrackedData();
    if (app) {
      await app.close();
    }
  });

  it('rejects delivery order when delivery stock is insufficient', async () => {
    const customer = await registerCustomer();
    const { product } = await createProductWithStocks({
      deliveryStock: 1,
      pickupStock: 3,
    });

    await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        fulfillmentType: 'delivery',
        items: [
          {
            productId: product.id,
            quantity: 2,
          },
        ],
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(400);
        expect(String(body.message)).toContain('Insufficient delivery stock');
      });
  });

  it('decrements pickup stock on order confirmation for pickup orders', async () => {
    const customer = await registerCustomer();
    const admin = await createAndLoginAdmin();
    const { product, store } = await createProductWithStocks({
      deliveryStock: 5,
      pickupStock: 4,
    });

    const createOrderResponse = await request(app.getHttpServer())
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer.accessToken}`)
      .send({
        fulfillmentType: 'pickup',
        pickupStoreId: store.id,
        items: [
          {
            productId: product.id,
            quantity: 2,
          },
        ],
      })
      .expect(201);

    const orderId = createOrderResponse.body.data.id as string;
    trackedOrderIds.add(orderId);

    await request(app.getHttpServer())
      .patch(`/api/orders/${orderId}/status`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({ status: 'CONFIRMED' })
      .expect(200);

    const pickupStock = await storeStocksRepository.findOne({
      where: {
        product: { id: product.id },
        store: { id: store.id },
      },
    });
    const deliveryStock = await deliveryStocksRepository.findOne({
      where: {
        product: { id: product.id },
      },
    });

    expect(pickupStock?.stock).toBe(2);
    expect(deliveryStock?.stock).toBe(5);
  });

  async function registerCustomer() {
    const email = `e2e.customer.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
    trackedUserEmails.add(email);

    const response = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email,
        password: 'StrongPass123!',
        firstName: 'E2E',
        lastName: 'Customer',
      })
      .expect(201);

    return {
      email,
      accessToken: response.body.data.accessToken as string,
    };
  }

  async function createAndLoginAdmin() {
    const email = `e2e.admin.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
    trackedUserEmails.add(email);

    const admin = usersRepository.create({
      email,
      passwordHash: await bcrypt.hash('StrongPass123!', 10),
      firstName: 'E2E',
      lastName: 'Admin',
      role: Role.ADMIN,
      isActive: true,
      avatar: null,
    });
    await usersRepository.save(admin);

    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        email,
        password: 'StrongPass123!',
      })
      .expect(201);

    return {
      email,
      accessToken: response.body.data.accessToken as string,
    };
  }

  async function createProductWithStocks(params: { deliveryStock: number; pickupStock: number }) {
    let store = await storesRepository.findOne({ where: { isActive: true }, order: { code: 'ASC' } });
    if (!store) {
      store = await storesRepository.save(
        storesRepository.create({
          code: `E2E-${Date.now()}`,
          name: 'E2E Store',
          city: 'Lima',
          country: 'Peru',
          address: 'E2E Address',
          isActive: true,
        }),
      );
      trackedStoreIds.add(store.id);
    }

    const category = categoriesRepository.create({
      name: `E2E Category ${Date.now()} ${Math.random().toString(36).slice(2)}`,
      slug: `e2e-category-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
    });
    const savedCategory = await categoriesRepository.save(category);
    trackedCategoryIds.add(savedCategory.id);

    const product = productsRepository.create({
      name: `E2E Product ${Date.now()} ${Math.random().toString(36).slice(2)}`,
      sku: `E2E-SKU-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      slug: `e2e-product-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      description: null,
      graphicDescription: null,
      usageMode: null,
      basePrice: '10.00',
      currencyCode: 'USD',
      stock: params.deliveryStock + params.pickupStock,
      weightValue: null,
      weightUnit: null,
      lengthValue: null,
      widthValue: null,
      heightValue: null,
      dimensionUnit: null,
      attributeValues: [],
      category: savedCategory,
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
    });

    const savedProduct = await productsRepository.save(product);
    trackedProductIds.add(savedProduct.id);

    await deliveryStocksRepository.save(
      deliveryStocksRepository.create({
        product: savedProduct,
        stock: params.deliveryStock,
      }),
    );

    await storeStocksRepository.save(
      storeStocksRepository.create({
        product: savedProduct,
        store,
        stock: params.pickupStock,
      }),
    );

    return {
      store,
      product: savedProduct,
    };
  }

  async function cleanupTrackedData() {
    if (trackedOrderIds.size) {
      await ordersRepository.delete({ id: In([...trackedOrderIds]) });
      trackedOrderIds.clear();
    }

    if (trackedProductIds.size) {
      await inventoryMovementsRepository.delete({
        product: { id: In([...trackedProductIds]) },
      });
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
