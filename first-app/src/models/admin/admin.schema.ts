import { Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';
@Schema({ timestamps: true, discriminatorKey: 'role' })
export class Admin {
  _id: Types.ObjectId;
  userName: string;
  email: string;
  password: string;
  phoneNumber: string;
  isActive: boolean;
}
export const adminSchema = SchemaFactory.createForClass(Admin);
