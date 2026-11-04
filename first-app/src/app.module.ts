import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from './config/configuration';
import paymobConfig from './config/paymob.config';
import { MongooseModule } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { AuthModule } from './modules/auth/auth.module';
import { UserModule } from './modules/user/user.module';
import { BrandModule } from './modules/brand/brand.module';
import { CacheModule } from '@nestjs/cache-manager';
import { CacheConfigService } from './shared/cache/cache.config.service';
import { CustomCacheModule } from './shared/cache/custom-cache.module';
import { MailModule } from './shared/mailer/mail.module';
import { PermissionsModule } from './modules/permissions/permissions.module';
import { FileUploadsModule } from './shared/file-uploads/file-uploads.module';
import { CategoryModule } from './modules/category/category.module';
import { ProductModule } from './modules/product/product.module';
import { SellingEntityModule } from './modules/selling-entity/selling-entity.module';
import { OrderModule } from './modules/order/order.module';
import { PaymentModule } from './modules/payment/payment.module';
import { SharedPaymentModule } from './shared/payment/shared-payment.module';
import { CouponModule } from './modules/coupon/coupon.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { AuditModule } from './modules/audit/audit.module';
import { AuditLogInterceptor } from './common/interceptors/audit-log.interceptor';
import { NotificationModule } from './modules/notification/notification.module';
import { SellerPayoutModule } from './modules/seller-payout/seller-payout.module';
import { ReturnModule } from './modules/return/return.module';
import { ReviewModule } from './modules/review/review.module';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { join } from 'path';
import { StorefrontModule } from './modules/storefront/storefront.module';
import { DataloaderModule } from './modules/storefront/dataloader/dataloader.module';
import { DataloaderService } from './modules/storefront/dataloader/dataloader.service';
import { AuthenticationGuard } from './common/guards/authentication.guard';
import { ApprovedEntityGuard } from './common/guards/approved-entity.guard';
import { PermissionsGuard } from './common/guards/permissions.guard';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { CartModule } from './modules/cart/cart.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, load: [configuration, paymobConfig] }),
    EventEmitterModule.forRoot(),

    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useClass: CacheConfigService,
    }),
    CustomCacheModule,
    MailModule,
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
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      imports: [DataloaderModule],
      inject: [DataloaderService],
      useFactory: (dataloaderService: DataloaderService) => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        playground: true,
        sortSchema: true,
        context: ({ req, res }: any) => ({
          req,
          res,
          loaders: dataloaderService.createLoaders(),
        }),
      }),
    }),
    AuthModule,
    UserModule,
    BrandModule,
    PermissionsModule,
    FileUploadsModule,
    CategoryModule,
    ProductModule,
    SellingEntityModule,
    OrderModule,
    PaymentModule,
    SharedPaymentModule,
    CouponModule,
    AuditModule,
    NotificationModule,
    StorefrontModule,
    SellerPayoutModule,
    ReturnModule,
    ReviewModule,
    DashboardModule,
    CartModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AuthenticationGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ApprovedEntityGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
  ],
})
export class AppModule {}
