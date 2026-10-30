import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  logger.log('Starting NestJS application...');
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'Idempotency-Key',
      'idempotency-key',
      'x-requested-with',
    ],
    exposedHeaders: ['Idempotency-Key', 'idempotency-key'],
    optionsSuccessStatus: 200,
  });

  // Swagger (OpenAPI) Documentation Setup
  const config = new DocumentBuilder()
    .setTitle('Multi-Vendor Marketplace API')
    .setDescription(
      'Enterprise E-Commerce Platform API Documentation (Ledger, Multi-Tenancy, COD Verification, Escrow, Payouts)',
    )
    .setVersion('1.0.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT-auth',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'none',
      filter: true,
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Server listening on port ${port}`);
  logger.log(`Swagger documentation ready at: http://localhost:${port}/api/docs`);
  logger.log(`GraphQL Playground ready at: http://localhost:${port}/graphql`);
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
