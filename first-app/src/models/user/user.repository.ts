import { AbstractRepo } from '../abstract.repository';
import { IUser } from '../../common/interfaces/user.interface';
import { Model } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';
import { Injectable } from '@nestjs/common';
import { User } from './user.schema';

@Injectable()
export class UserRepo extends AbstractRepo<IUser> {
  constructor(@InjectModel(User.name) userModel: Model<IUser>) {
    super(userModel);
  }
}
