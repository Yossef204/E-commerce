import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CategoryRepo } from '../../models/category/category.repository';
import {
  Category,
  CategorySchema,
} from '../../models/category/category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Category.name,
        schema: CategorySchema,
      },
    ]),
  ],
  controllers: [],
  providers: [CategoryRepo],
  exports: [CategoryRepo],
})
export class CategoryMongoModule {}
