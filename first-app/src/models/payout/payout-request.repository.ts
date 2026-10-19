import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { PayoutRequest, TPayoutRequest } from './payout-request.schema';

@Injectable()
export class PayoutRequestRepo extends AbstractRepo<TPayoutRequest> {
  constructor(
    @InjectModel(PayoutRequest.name)
    payoutRequestModel: Model<TPayoutRequest>,
  ) {
    super(payoutRequestModel);
  }

  public get model(): Model<TPayoutRequest> {
    return this._model;
  }
}

