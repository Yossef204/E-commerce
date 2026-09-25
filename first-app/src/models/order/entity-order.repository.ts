import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { EntityOrder, TEntityOrder } from './entity-order.schema';

@Injectable()
export class EntityOrderRepo extends AbstractRepo<TEntityOrder> {
  constructor(@InjectModel(EntityOrder.name) entityOrderModel: Model<TEntityOrder>) {
    super(entityOrderModel);
  }
}

