import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { EscrowLedger, TEscrow } from './escrow.schema';

@Injectable()
export class EscrowRepo extends AbstractRepo<TEscrow> {
  constructor(@InjectModel(EscrowLedger.name) escrowModel: Model<TEscrow>) {
    super(escrowModel);
  }
}

