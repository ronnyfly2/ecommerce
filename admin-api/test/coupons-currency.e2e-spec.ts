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
import { Coupon } from '../src/coupons/entities/coupon.entity';
import { CouponType } from '../src/coupons/enums/coupon-type.enum';
import { User } from '../src/users/entities/user.entity';

jest.setTimeout(20000);

describe('Coupons Currency Conversion (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let couponsRepository: Repository<Coupon>;
  const trackedEmails = new Set<string>();
  const trackedCouponCodes = new Set<string>();

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
    couponsRepository = moduleFixture.get<Repository<Coupon>>(getRepositoryToken(Coupon));
  });

  afterEach(async () => {
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    await app.close();
  });

  it('converts fixed coupons and minimum order amount between PEN and USD', async () => {
    const server = app.getHttpServer();
    const email = `e2e.coupons.fx.${Date.now()}@example.com`;
    const password = 'CouponsFx123!';
    const code = `FXPEN${Date.now()}`;

    trackedEmails.add(email);
    trackedCouponCodes.add(code);

    await request(server)
      .post('/api/auth/register')
      .send({
        email,
        password,
        firstName: 'Coupons',
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
      .post('/api/coupons')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code,
        type: CouponType.FIXED_AMOUNT,
        value: '37.50',
        minOrderAmount: '75.00',
        currencyCode: 'PEN',
        isActive: true,
      })
      .expect(201);

    const validInUsdResponse = await request(server)
      .post('/api/coupons/validate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code,
        orderAmount: 30,
        currencyCode: 'USD',
      });

    if (validInUsdResponse.status !== 201) {
      throw new Error(`Unexpected validate status: ${validInUsdResponse.status} body=${JSON.stringify(validInUsdResponse.body)}`);
    }

    expect(validInUsdResponse.body.statusCode).toBe(201);
    expect(validInUsdResponse.body.data.currencyCode).toBe('USD');
    expect(validInUsdResponse.body.data.discount).toBe(10);
    expect(validInUsdResponse.body.data.finalAmount).toBe(20);

    await request(server)
      .post('/api/coupons/validate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        code,
        orderAmount: 10,
        currencyCode: 'USD',
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toContain('Minimum order amount is 20.00 USD');
      });
  });

  async function cleanup() {
    if (trackedCouponCodes.size > 0) {
      await couponsRepository.delete({ code: In([...trackedCouponCodes]) });
      trackedCouponCodes.clear();
    }

    if (trackedEmails.size > 0) {
      await usersRepository.delete({ email: In([...trackedEmails]) });
      trackedEmails.clear();
    }
  }
});
