import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ReturnRequest,
  ReturnRequestSchema,
} from '../../models/return/return-request.schema';
import { ReturnRequestRepo } from '../../models/return/return-request.repository';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ReturnRequest.name, schema: ReturnRequestSchema },
    ]),
  ],
  providers: [ReturnRequestRepo],
  exports: [ReturnRequestRepo],
})
export class ReturnMongoModule {}

