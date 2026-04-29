import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Security headers (X-Frame-Options, CSP, HSTS, etc.)
  app.use(helmet());

  // CORS — only allow our frontend origin
  app.enableCors({
    origin: process.env.WEB_URL ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Global prefix for all routes: /api/v1/...
  app.setGlobalPrefix('api/v1');

  // Global validation pipe — validates all incoming DTOs automatically.
  // whitelist: strips unknown fields so clients can't inject extra properties
  // transform: auto-converts types (e.g. string "123" → number 123)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Global error handler — returns consistent JSON error responses
  app.useGlobalFilters(new HttpExceptionFilter());

  // Swagger API docs (disable in production if desired)
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Empleado IA API')
      .setDescription('API para la plataforma Empleado IA para WhatsApp')
      .setVersion('1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
    logger.log('Swagger docs at http://localhost:3001/api/docs');
  }

  const port = process.env.API_PORT ?? 3001;
  await app.listen(port);
  logger.log(`API running on port ${port}`);
}

bootstrap();
