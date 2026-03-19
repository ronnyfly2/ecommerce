import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { createHash } from 'crypto';
import request from 'supertest';
import { App } from 'supertest/types';
import { In, Repository } from 'typeorm';
import { AppModule } from '../src/app.module';
import { PasswordResetToken } from '../src/auth/entities/password-reset-token.entity';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { TransformInterceptor } from '../src/common/interceptors/transform.interceptor';
import { User } from '../src/users/entities/user.entity';

describe('Auth (e2e)', () => {
  let app: INestApplication<App>;
  let usersRepository: Repository<User>;
  let passwordResetTokensRepository: Repository<PasswordResetToken>;
  const trackedEmails = new Set<string>();

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

    usersRepository = moduleFixture.get<Repository<User>>(getRepositoryToken(User));
    passwordResetTokensRepository = moduleFixture.get<Repository<PasswordResetToken>>(
      getRepositoryToken(PasswordResetToken),
    );
  });

  afterAll(async () => {
    await cleanupTrackedUsers();
    await app.close();
  });

  afterEach(async () => {
    await cleanupTrackedUsers();
  });

  it('registers, refreshes, lists sessions, revokes session and invalidates refresh after logout-all', async () => {
    const server = app.getHttpServer();
    const client = request.agent(server);
    trackedEmails.add(email);

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

  it('requests password reset, resets password with known token, and logs in with the new password', async () => {
    const server = app.getHttpServer();
    const client = request.agent(server);

    const resetEmail = `e2e.reset.${Date.now()}@example.com`;
    const oldPassword = 'ResetOldPass123!';
    const newPassword = 'ResetNewPass123!';
    trackedEmails.add(resetEmail);

    await client
      .post('/api/auth/register')
      .set('user-agent', userAgent)
      .send({
        email: resetEmail,
        password: oldPassword,
        firstName: 'Reset',
        lastName: 'User',
      })
      .expect(201);

    await client
      .post('/api/auth/forgot-password')
      .set('user-agent', userAgent)
      .send({ email: resetEmail })
      .expect(201)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(201);
        expect(body.data.message).toBe('If that email exists, you will receive a password reset link');
      });

    const user = await usersRepository.findOne({ where: { email: resetEmail } });
    expect(user).not.toBeNull();

    const forgotToken = await passwordResetTokensRepository.findOne({
      where: {
        user: { id: user!.id },
      },
      order: {
        createdAt: 'DESC',
      },
      relations: ['user'],
    });

    expect(forgotToken).not.toBeNull();
    expect(forgotToken?.usedAt).toBeNull();

    const knownToken = `known-reset-token-${Date.now()}`;
    const knownTokenHash = createHash('sha256').update(knownToken).digest('hex');

    await passwordResetTokensRepository.delete({
      user: { id: user!.id },
    });

    const knownResetToken = passwordResetTokensRepository.create({
      user: user!,
      tokenHash: knownTokenHash,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      usedAt: null,
    });

    await passwordResetTokensRepository.save(knownResetToken);

    await client
      .post('/api/auth/reset-password')
      .set('user-agent', userAgent)
      .send({ token: knownToken, password: newPassword })
      .expect(201)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(201);
        expect(body.data.message).toBe('Password reset successfully');
      });

    await client
      .post('/api/auth/login')
      .set('user-agent', userAgent)
      .send({ email: resetEmail, password: newPassword })
      .expect(201)
      .expect(({ body }) => {
        expect(body.statusCode).toBe(201);
        expect(body.data.accessToken).toEqual(expect.any(String));
      });

    await client
      .post('/api/auth/login')
      .set('user-agent', userAgent)
      .send({ email: resetEmail, password: oldPassword })
      .expect(401);
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