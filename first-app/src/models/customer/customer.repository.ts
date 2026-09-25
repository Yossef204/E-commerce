import { AbstractRepo } from '../abstract.repository';
import { ICustomer } from '../../common/interfaces/user.interface';
import { Model } from 'mongoose';
import { Customer } from './customer.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';

@Injectable()
export class CustomerRepo extends AbstractRepo<ICustomer> {
  constructor(@InjectModel(Customer.name) customerModel: Model<ICustomer>) {
    super(customerModel);
  }
}
