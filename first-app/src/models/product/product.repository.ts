import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { Product, TProduct } from './product.schema';

@Injectable()
export class ProductRepo extends AbstractRepo<TProduct> {
  constructor(@InjectModel(Product.name) productModel: Model<TProduct>) {
    super(productModel);
  }
}
