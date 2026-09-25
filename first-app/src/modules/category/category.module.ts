import { Module } from '@nestjs/common';
import { CategoryService } from './category.service';
import { CategoryController } from './category.controller';
import { CategoryMongoModule } from '../../shared/modules/category.mongo.module';
import { CategoryFactory } from './factory/category.factory';

@Module({
  imports: [CategoryMongoModule],
  controllers: [CategoryController],
  providers: [CategoryService, CategoryFactory],
})
export class CategoryModule {}
