import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { Session, TSession } from './session.schema';

@Injectable()
export class SessionRepo extends AbstractRepo<TSession> {
  constructor(@InjectModel(Session.name) sessionModel: Model<TSession>) {
    super(sessionModel);
  }
}

