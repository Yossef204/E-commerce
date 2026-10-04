import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { CouponUsage, TCouponUsage } from './coupon-usage.schema';

@Injectable()
export class CouponUsageRepo extends AbstractRepo<TCouponUsage> {
  constructor(
    @InjectModel(CouponUsage.name) couponUsageModel: Model<TCouponUsage>,
  ) {
    super(couponUsageModel);
  }

  public async countUserUsages(
    couponId: Types.ObjectId,
    userId: Types.ObjectId,
  ): Promise<number> {
    return this._model.countDocuments({ couponId, userId }).exec();
  }
}
