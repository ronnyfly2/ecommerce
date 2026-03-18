import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;

  const userAgent = 'e2e-auth-test-agent/1.0';
  const email = `e2e.auth.${Date.now()}@example.com`;
  const password = 'StrongPass123!';

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
  });

  afterAll(async () => {
    await app.close();
  });

  it('registers, refreshes, lists sessions, revokes session and invalidates refresh after logout-all', async () => {
    const server = app.getHttpServer();
    const client = request.agent(server);

    const registerResponse = await client
      .post('/api/auth/register')
      .set('user-agent', userAgent)
      .send({
        email,
        password,
        firstName: 'E2E',
        lastName: 'Auth',
      })
      .expect(201);

    expect(registerResponse.body.statusCode).toBe(201);
    expect(registerResponse.body.data.accessToken).toEqual(expect.any(String));
    expect(registerResponse.body.data.user.email).toBe(email);

    const loginResponse = await client
      .post('/api/auth/login')
      .set('user-agent', userAgent)
      .send({ email, password })
      .expect(201);

    const accessToken = loginResponse.body.data.accessToken as string;
    expect(accessToken).toEqual(expect.any(String));

    const refreshResponse = await client
      .post('/api/auth/refresh')
      .set('user-agent', userAgent)
      .send({})
      .expect(201);

    expect(refreshResponse.body.statusCode).toBe(201);
    expect(refreshResponse.body.data.accessToken).toEqual(expect.any(String));

    const sessionsResponse = await client
      .get('/api/auth/sessions')
      .set('user-agent', userAgent)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    expect(Array.isArray(sessionsResponse.body.data)).toBe(true);
    expect(sessionsResponse.body.data.length).toBeGreaterThan(0);

    const tokenId = sessionsResponse.body.data[0]?.tokenId as string;
    expect(tokenId).toEqual(expect.any(String));

    await client
      .post('/api/auth/logout-device')
      .set('user-agent', userAgent)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ tokenId })
      .expect(201)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(201);
        expect(body.data.message).toBe('Session revoked');
      });

    await client
      .post('/api/auth/logout-all')
      .set('user-agent', userAgent)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({})
      .expect(201)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(201);
        expect(body.data.message).toBe('All sessions closed');
      });

    await client
      .post('/api/auth/refresh')
      .set('user-agent', userAgent)
      .send({})
      .expect(401)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(401);
      });
  });
});