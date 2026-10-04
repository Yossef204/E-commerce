import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { LedgerRepo } from '../../models/ledger/ledger.repository';
import {
  LedgerEntry,
  LedgerEntrySchema,
} from '../../models/ledger/ledger-entry.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: LedgerEntry.name,
        schema: LedgerEntrySchema,
      },
    ]),
  ],
  providers: [LedgerRepo],
  exports: [LedgerRepo],
})
export class LedgerMongoModule {}
