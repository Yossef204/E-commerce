import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { SellingEntity, TSellingEntity } from './selling-entity.schema';

@Injectable()
export class SellingEntityRepo extends AbstractRepo<TSellingEntity> {
  constructor(@InjectModel(SellingEntity.name) sellingEntityModel: Model<TSellingEntity>) {
    super(sellingEntityModel);
  }
}

