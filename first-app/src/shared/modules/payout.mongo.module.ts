import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VendorPayout, VendorPayoutSchema } from '../../models/payout/payout.schema';
import { PayoutRepo } from '../../models/payout/payout.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: VendorPayout.name, schema: VendorPayoutSchema }]),
  ],
  providers: [PayoutRepo],
  exports: [PayoutRepo],
})
export class PayoutMongoModule {}

