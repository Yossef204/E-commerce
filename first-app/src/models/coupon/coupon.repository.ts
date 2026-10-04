import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { Coupon, TCoupon } from './coupon.schema';

@Injectable()
export class CouponRepo extends AbstractRepo<TCoupon> {
  constructor(@InjectModel(Coupon.name) couponModel: Model<TCoupon>) {
    super(couponModel);
  }

  public async incrementUsedCount(
    couponId: Types.ObjectId,
    options?: any,
  ): Promise<TCoupon | null> {
    return this.updateOne(
      { _id: couponId },
      { $inc: { usedCount: 1 } },
      options,
    );
  }
}
