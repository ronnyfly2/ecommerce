import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { App } from 'supertest/types';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { Role } from '../src/common/enums/role.enum';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { Order } from '../src/orders/entities/order.entity';
import { User } from '../src/users/entities/user.entity';

jest.setTimeout(20000);

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let ordersRepository: Repository<Order>;
  const trackedEmails = new Set<string>();

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
    usersRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    ordersRepository = moduleFixture.get<Repository<Order>>(getRepositoryToken(Order));
  });

  afterEach(async () => {
    await cleanupTrackedUsers();
  });

  afterAll(async () => {
    await cleanupTrackedUsers();
    await app.close();
  });

  it('returns sales and inventory summary for admin users', async () => {
    const server = app.getHttpServer();
    const email = `e2e.dashboard.admin.${Date.now()}@example.com`;
    const password = 'AdminDash123!';
    trackedEmails.add(email);

    await request(server)
      .post('/api/auth/register')
      .send({
        email,
        password,
        firstName: 'Dashboard',
        lastName: 'Admin',
      })
      .expect(201);

    await usersRepository.update({ email }, { role: Role.ADMIN });

    const loginResponse = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    const accessToken = loginResponse.body.data.accessToken as string;

    await request(server)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(200);
        expect(body.data.orderStats).toEqual(
          expect.objectContaining({
            totalOrders: expect.any(Number),
            totalRevenue: expect.any(Number),
            pendingOrders: expect.any(Number),
          }),
        );
        expect(body.data.sales).toEqual(
          expect.objectContaining({
            period: expect.objectContaining({
              preset: expect.any(String),
              from: expect.any(String),
              to: expect.any(String),
              days: expect.any(Number),
            }),
            trend: expect.objectContaining({
              totalOrders: expect.any(Number),
              totalRevenue: expect.any(Number),
              points: expect.any(Array),
            }),
            comparison: expect.objectContaining({
              currentRevenue: expect.any(Number),
              previousRevenue: expect.any(Number),
            }),
          }),
        );
        expect(body.data.sales.trend.points).toHaveLength(7);
        expect(body.data.inventoryAlerts).toEqual(
          expect.objectContaining({
            threshold: expect.any(Number),
            lowStockCount: expect.any(Number),
            outOfStockCount: expect.any(Number),
            lowStockVariants: expect.any(Array),
          }),
        );
      });
  });

  it('hides inventory alerts for customer users while keeping order and sales summary', async () => {
    const server = app.getHttpServer();
    const email = `e2e.dashboard.customer.${Date.now()}@example.com`;
    const password = 'CustomerDash123!';
    trackedEmails.add(email);

    await request(server)
      .post('/api/auth/register')
      .send({
        email,
        password,
        firstName: 'Dashboard',
        lastName: 'Customer',
      })
      .expect(201);

    const loginResponse = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    const accessToken = loginResponse.body.data.accessToken as string;

    await request(server)
      .get('/api/dashboard/summary')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(200);
        expect(body.data.orderStats).toBeDefined();
        expect(body.data.sales).toBeDefined();
        expect(body.data.inventoryAlerts).toBeNull();
      });
  });

  it('converts mixed currency orders to USD in stats and dashboard summary', async () => {
    const server = app.getHttpServer();
    const email = `e2e.dashboard.fx.${Date.now()}@example.com`;
    const password = 'AdminFx123!';
    trackedEmails.add(email);

    await request(server)
      .post('/api/auth/register')
      .send({
        email,
        password,
        firstName: 'Dashboard',
        lastName: 'Fx',
      })
      .expect(201);

    await usersRepository.update({ email }, { role: Role.ADMIN });

    const user = await usersRepository.findOne({ where: { email } });
    expect(user).toBeTruthy();

    const savedOrders = await ordersRepository.save([
      ordersRepository.create({
        user: user as User,
        status: OrderStatus.PENDING,
        subtotal: '100.00',
        discount: '0.00',
        total: '100.00',
        currencyCode: 'USD',
        exchangeRateToUsd: '1.000000',
        notes: null,
      }),
      ordersRepository.create({
        user: user as User,
        status: OrderStatus.PENDING,
        subtotal: '375.00',
        discount: '0.00',
        total: '375.00',
        currencyCode: 'PEN',
        exchangeRateToUsd: '3.750000',
        notes: null,
      }),
    ]);

    const orderDay = savedOrders[0].createdAt.toISOString().slice(0, 10);

    const loginResponse = await request(server)
      .post('/api/auth/login')
      .send({ email, password })
      .expect(201);

    const accessToken = loginResponse.body.data.accessToken as string;

    await request(server)
      .get('/api/orders/stats')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(200);
        expect(body.data.totalOrders).toBe(2);
        expect(body.data.totalRevenue).toBe(200);
      });

    await request(server)
      .get(`/api/dashboard/summary?salesPreset=custom&from=${orderDay}&to=${orderDay}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(200);
        expect(body.data.orderStats.totalRevenue).toBe(200);
      });
  });

  async function cleanupTrackedUsers() {
    if (trackedEmails.size === 0) {
      return;
    }

    const users = await usersRepository.find({
      where: {
        email: In([...trackedEmails]),
      },
      select: {
        id: true,
      },
    });

    if (users.length > 0) {
      await ordersRepository
        .createQueryBuilder()
        .delete()
        .where('user_id IN (:...userIds)', { userIds: users.map((user) => user.id) })
        .execute();
    }

    await usersRepository.delete({
      email: In([...trackedEmails]),
    });

    trackedEmails.clear();
  }
});