import { Injectable, MethodNotAllowedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { AbstractRepo } from '../abstract.repository';
import { LedgerEntry, TLedgerEntry } from './ledger-entry.schema';

@Injectable()
export class LedgerRepo extends AbstractRepo<TLedgerEntry> {
  constructor(
    @InjectModel(LedgerEntry.name) ledgerModel: Model<TLedgerEntry>,
  ) {
    super(ledgerModel);
  }

  public async updateOne(): Promise<never> {
    throw new MethodNotAllowedException(
      'Ledger entries are immutable append-only records and cannot be updated.',
    );
  }

  public async updateMany(): Promise<never> {
    throw new MethodNotAllowedException(
      'Ledger entries are immutable append-only records and cannot be updated.',
    );
  }

  public async deleteOne(): Promise<never> {
    throw new MethodNotAllowedException(
      'Ledger entries are immutable append-only records and cannot be deleted.',
    );
  }
}
