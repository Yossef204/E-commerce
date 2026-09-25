import { AbstractRepo } from '../abstract.repository';
import { IAdmin } from '../../common/interfaces/user.interface';
import { Model } from 'mongoose';
import { Admin } from './admin.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AdminRepo extends AbstractRepo<IAdmin> {
  constructor(@InjectModel(Admin.name) adminModel: Model<IAdmin>) {
    super(adminModel);
  }
}
