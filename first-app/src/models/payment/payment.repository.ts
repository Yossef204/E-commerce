import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { Payment, TPayment } from './payment.schema';

@Injectable()
export class PaymentRepo extends AbstractRepo<TPayment> {
  constructor(@InjectModel(Payment.name) paymentModel: Model<TPayment>) {
    super(paymentModel);
  }
}
