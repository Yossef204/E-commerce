import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { Category, TCategory } from './category.schema';

@Injectable()
export class CategoryRepo extends AbstractRepo<TCategory> {
  constructor(@InjectModel(Category.name) categoryModel: Model<TCategory>) {
    super(categoryModel);
  }
}
