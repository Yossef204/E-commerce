import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { ReturnRequest, TReturnRequest } from './return-request.schema';

@Injectable()
export class ReturnRequestRepo extends AbstractRepo<TReturnRequest> {
  constructor(
    @InjectModel(ReturnRequest.name) returnModel: Model<TReturnRequest>,
  ) {
    super(returnModel);
  }

  public get model(): Model<TReturnRequest> {
    return this._model;
  }
}

