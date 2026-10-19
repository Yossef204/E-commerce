import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { CategoryMongoModule } from '../../shared/modules/category.mongo.module';
import { CategoryFactory } from './factory/category.factory';

@Module({
  imports: [CategoryMongoModule, JwtModule],
  controllers: [CategoryController],
  providers: [CategoryService, CategoryFactory],
  exports: [CategoryService],
})
export class CategoryModule {}
