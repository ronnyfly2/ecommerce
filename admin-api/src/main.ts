import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);
  const isProduction = configService.get<string>('NODE_ENV') === 'production';

  // CORS
  const corsOrigin = configService.get<string>('CORS_ORIGIN');
  const configuredOrigins = corsOrigin
    ? corsOrigin
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean)
    : [];
  const defaultDevOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'];
  const allowedOrigins =
    configuredOrigins.length > 0 ? configuredOrigins : isProduction ? [] : defaultDevOrigins;

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
  });

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

  app.use(json({ limit: '5mb' }));
  app.use(urlencoded({ extended: true, limit: '5mb' }));

  const uploadDir = configService.getOrThrow<string>('UPLOAD_DIR');
  const absoluteUploadDir = join(process.cwd(), uploadDir);

  if (!existsSync(absoluteUploadDir)) {
    mkdirSync(absoluteUploadDir, { recursive: true });
  }

  app.useStaticAssets(absoluteUploadDir, { prefix: '/uploads' });

  // Swagger solo en desarrollo
  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('Ecommerce Admin API')
      .setDescription('Admin panel backend for ecommerce platform')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document);
  }

  // Graceful shutdown
  app.enableShutdownHooks();

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
}
bootstrap();
