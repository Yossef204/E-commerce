import { AbstractRepo } from '../abstract.repository';
import { ISeller } from '../../common/interfaces/user.interface';
import { Model } from 'mongoose';
import { Seller } from './seller.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SellerRepo extends AbstractRepo<ISeller> {
  constructor(@InjectModel(Seller.name) sellerModel: Model<ISeller>) {
    super(sellerModel);
  }
}
