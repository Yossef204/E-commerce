import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Payment, PaymentSchema } from '../../models/payment/payment.schema';
import { PaymentRepo } from '../../models/payment/payment.repository';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Payment.name, schema: PaymentSchema }]),
  ],
  providers: [PaymentRepo],
  exports: [PaymentRepo],
})
export class PaymentMongoModule {}

