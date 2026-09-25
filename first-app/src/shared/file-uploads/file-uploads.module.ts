import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { FileUploadsController } from './file-uploads.controller';
import { FileUploadsService } from './file-uploads.service';
import { STORAGE_PROVIDER } from './providers/upload.providers.interface';
import { S3StorageProvider } from './providers/s3.providers';
import { CloudinaryStorageProvider } from './providers/cloudinary.providers';
import { JwtModule } from '@nestjs/jwt';

@Module({
  imports: [
    ConfigModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('jwt').accessSecret as string,
        signOptions: { expiresIn: '1d' },
      }),
    }),
  ],
  controllers: [FileUploadsController],
  providers: [
    FileUploadsService,
    S3StorageProvider,
    // احذف CloudinaryStorageProvider من هنا حتى لا يُنشئه NestJS تلقائياً
    {
      provide: STORAGE_PROVIDER,
      useFactory: (
        configService: ConfigService,
        s3Provider: S3StorageProvider,
      ) => {
        const driver = configService.get('STORAGE_DRIVER', 's3');

        // لا يتم إنشاء Cloudinary إلا لو تم طلبه فعلياً من الـ .env
        if (driver === 'cloudinary') {
          return new CloudinaryStorageProvider(configService);
        }

        return s3Provider;
      },
      inject: [ConfigService, S3StorageProvider],
    },
  ],
  exports: [FileUploadsService],
})
export class FileUploadsModule {}
