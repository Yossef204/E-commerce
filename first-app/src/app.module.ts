import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AuthModule } from './modules/auth/auth.module';
import { BrandModule } from './modules/brand/brand.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheConfigService } from './shared/cache/cache.config.service';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { FileUploadsModule } from './shared/file-uploads/file-uploads.module';
import { CategoryModule } from './modules/category/category.module';
import { ProductModule } from './modules/product/product.module';
import { SellingEntityModule } from './modules/selling-entity/selling-entity.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuditModule } from './modules/audit/audit.module';
import { NotificationModule } from './modules/notification/notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration] }),
    EventEmitterModule.forRoot(),

    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useClass: CacheConfigService,
    }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        uri: configService.get('database').url,
        onConnectionCreate: (connection: Connection) => {
          connection.on('connected', () => {
            console.log('DB connected successfully');
          });
          connection.on('disconnected', () => {
            console.log('DB disconnected');
          });
        },
      }),
    }),
    AuthModule,
    BrandModule,
    PermissionsModule,
    FileUploadsModule,
    CategoryModule,
    ProductModule,
    SellingEntityModule,
    OrderModule,
    PaymentModule,
    AuditModule,
    NotificationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
