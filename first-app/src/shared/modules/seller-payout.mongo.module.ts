import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  SellerPayoutMethod,
  SellerPayoutMethodSchema,
} from '../../models/payout/seller-payout-method.schema';
import { SellerPayoutMethodRepo } from '../../models/payout/seller-payout-method.repository';
import {
  PayoutRequest,
  PayoutRequestSchema,
} from '../../models/payout/payout-request.schema';
import { PayoutRequestRepo } from '../../models/payout/payout-request.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: SellerPayoutMethod.name,
        schema: SellerPayoutMethodSchema,
      },
      {
        name: PayoutRequest.name,
        schema: PayoutRequestSchema,
      },
    ]),
  ],
  providers: [SellerPayoutMethodRepo, PayoutRequestRepo],
  exports: [SellerPayoutMethodRepo, PayoutRequestRepo],
})
export class SellerPayoutMongoModule {}

