import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { MainOrder, TMainOrder } from './main-order.schema';

@Injectable()
export class MainOrderRepo extends AbstractRepo<TMainOrder> {
  constructor(@InjectModel(MainOrder.name) mainOrderModel: Model<TMainOrder>) {
    super(mainOrderModel);
  }
}
