import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

const localOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3004',
  'http://localhost:3005',
  'http://localhost:3100',
  'http://localhost:5004',
  'http://localhost:19006',
  'http://localhost:8081',
  'http://localhost:8082',
];

const productionOrigins = [
  'https://bookmyfit.in',
  'https://www.bookmyfit.in',
  'https://admin.bookmyfit.in',
  'https://gym.bookmyfit.in',
  'https://corporate.bookmyfit.in',
  'https://wellness.bookmyfit.in',
];

function getAllowedOrigins(): Set<string> {
  const envOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  return new Set([...localOrigins, ...productionOrigins, ...envOrigins]);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const allowedOrigins = getAllowedOrigins();

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin denied: ${origin}`));
    },
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix('api/v1');

  const config = new DocumentBuilder()
    .setTitle('BookMyFit API')
    .setDescription('BookMyFit platform REST API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  const port = process.env.PORT || 3003;
  await app.listen(port);
  Logger.log(`🚀 BookMyFit API running on http://localhost:${port}`);
  Logger.log(`📚 Swagger docs at http://localhost:${port}/api/docs`);
}
bootstrap();
