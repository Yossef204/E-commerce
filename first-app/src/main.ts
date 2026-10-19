import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Server listening on port ${port}`);
  logger.log(`GraphQL Playground ready at: http://localhost:${port}/graphql`);
}
// eslint-disable-next-line @typescript-eslint/no-floating-promises
bootstrap();
