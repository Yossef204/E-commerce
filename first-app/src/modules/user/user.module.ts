import { Module } from '@nestjs/common';
import { UserService } from './user.service';
import { UserController } from './user.controller';
import { UserMongoModule } from '../../shared/modules/user.mongo.module';
import { FileUploadsModule } from '../../shared/file-uploads/file-uploads.module';

@Module({
  imports: [UserMongoModule, FileUploadsModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
