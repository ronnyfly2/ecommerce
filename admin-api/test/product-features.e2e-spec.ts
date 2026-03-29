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

jest.setTimeout(120000);

describe('Product Features (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let categoriesRepository: Repository<Category>;
  let productsRepository: Repository<Product>;

  const trackedUserEmails = new Set<string>();
  const trackedCategoryIds = new Set<string>();
  const trackedProductIds = new Set<string>();

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

  it('creates and updates product features array', async () => {
    const admin = await createAndLoginAdmin();
    const category = await createCategory();

    const createResponse = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        name: `E2E Features Product ${Date.now()}`,
        sku: `E2E-FEAT-${Date.now()}`,
        basePrice: 59.9,
        currencyCode: 'USD',
        stock: 3,
        categoryId: category.id,
        features: [
          { icon: 'https://cdn.example.com/icons/shield.svg', name: 'Pago seguro' },
          { icon: 'https://cdn.example.com/icons/truck.svg', name: 'Envio rapido' },
        ],
      })
      .expect(201);

    const createdProductId = createResponse.body.data.id as string;
    trackedProductIds.add(createdProductId);

    expect(createResponse.body.data.features).toHaveLength(2);
    expect(createResponse.body.data.features[0]).toMatchObject({
      icon: 'https://cdn.example.com/icons/shield.svg',
      name: 'Pago seguro',
    });

    await request(app.getHttpServer())
      .patch(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .send({
        features: [
          { icon: 'icon-gift', name: 'Regalo incluido' },
        ],
      })
      .expect(200)
      .expect(({ body }) => {
        expect(Array.isArray(body.data.features)).toBe(true);
        expect(body.data.features).toHaveLength(1);
        expect(body.data.features[0]).toMatchObject({
          icon: 'icon-gift',
          name: 'Regalo incluido',
        });
      });

    await request(app.getHttpServer())
      .get(`/api/products/${createdProductId}`)
      .set('Authorization', `Bearer ${admin.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.features).toHaveLength(1);
        expect(body.data.features[0]).toMatchObject({
          icon: 'icon-gift',
          name: 'Regalo incluido',
        });
      });
  });

  async function createAndLoginAdmin() {
    const email = `e2e.product.features.${Date.now()}.${Math.random().toString(36).slice(2)}@example.com`;
    trackedUserEmails.add(email);

    const admin = usersRepository.create({
      email,
      passwordHash: await bcrypt.hash('StrongPass123!', 10),
      firstName: 'E2E',
      lastName: 'Features',
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

  async function createCategory() {
    const category = await categoriesRepository.save(
      categoriesRepository.create({
        name: `E2E Feature Cat ${Date.now()} ${Math.random().toString(36).slice(2)}`,
        slug: `e2e-feature-cat-${Date.now()}-${Math.random().toString(36).slice(2)}`,
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
    return category;
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
  }
});
