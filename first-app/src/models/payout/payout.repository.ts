import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { VendorPayout, TPayout } from './payout.schema';

@Injectable()
export class PayoutRepo extends AbstractRepo<TPayout> {
  constructor(@InjectModel(VendorPayout.name) payoutModel: Model<TPayout>) {
    super(payoutModel);
  }
}

