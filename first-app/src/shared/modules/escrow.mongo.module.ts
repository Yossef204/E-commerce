import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { EscrowLedger, EscrowLedgerSchema } from '../../models/escrow/escrow.schema';
import { EscrowRepo } from '../../models/escrow/escrow.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: EscrowLedger.name, schema: EscrowLedgerSchema }]),
  ],
  providers: [EscrowRepo],
  exports: [EscrowRepo],
})
export class EscrowMongoModule {}

