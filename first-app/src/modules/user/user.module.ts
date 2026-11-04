import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { OrderMongoModule } from '../../shared/modules/order.mongo.module';
import { FileUploadsModule } from '../../shared/file-uploads/file-uploads.module';
import { SessionMongoModule } from '../../shared/modules/session.mongo.module';
import { CustomCacheModule } from '../../shared/cache/custom-cache.module';

@Module({
  imports: [
    UserMongoModule,
    SessionMongoModule,
    CustomCacheModule,
    OrderMongoModule,
    FileUploadsModule,
    JwtModule,
  ],
  controllers: [UserController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
