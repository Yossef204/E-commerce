import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import {
  SellerPayoutMethod,
  TSellerPayoutMethod,
} from './seller-payout-method.schema';

@Injectable()
export class SellerPayoutMethodRepo extends AbstractRepo<TSellerPayoutMethod> {
  constructor(
    @InjectModel(SellerPayoutMethod.name)
    sellerPayoutMethodModel: Model<TSellerPayoutMethod>,
  ) {
    super(sellerPayoutMethodModel);
  }

  public get model(): Model<TSellerPayoutMethod> {
    return this._model;
  }
}

