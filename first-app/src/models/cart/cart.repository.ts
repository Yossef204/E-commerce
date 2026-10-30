import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { Cart, TCart } from './cart.schema';

@Injectable()
export class CartRepo extends AbstractRepo<TCart> {
  constructor(@InjectModel(Cart.name) cartModel: Model<TCart>) {
    super(cartModel);
  }
}

