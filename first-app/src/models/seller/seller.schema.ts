import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
@Schema({ timestamps: true, discriminatorKey: 'role' })
export class Seller {
  _id: Types.ObjectId;
  userName: string;
  email: string;
  password: string;
  phoneNumber: string;
}
export const sellerSchema = SchemaFactory.createForClass(Seller);
