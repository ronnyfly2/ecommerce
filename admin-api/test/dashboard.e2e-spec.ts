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
import { User } from '../src/users/entities/user.entity';

describe('Dashboard (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
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
            trendLast7Days: expect.objectContaining({
              totalOrders: expect.any(Number),
              totalRevenue: expect.any(Number),
              points: expect.any(Array),
            }),
            weekComparison: expect.objectContaining({
              currentWeekRevenue: expect.any(Number),
              previousWeekRevenue: expect.any(Number),
            }),
          }),
        );
        expect(body.data.sales.trendLast7Days.points).toHaveLength(7);
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

  async function cleanupTrackedUsers() {
    if (trackedEmails.size === 0) {
      return;
    }

    await usersRepository.delete({
      email: In([...trackedEmails]),
    });

    trackedEmails.clear();
  }
});