import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { Brand, TBrand } from './brand.schema';

@Injectable()
export class BrandRepo extends AbstractRepo<TBrand> {
  constructor(@InjectModel(Brand.name) brandModel: Model<TBrand>) {
    super(brandModel);
  }
}
