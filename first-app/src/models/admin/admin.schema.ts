import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Types } from 'mongoose';

@Schema({ timestamps: true })
export class Admin {
  _id: Types.ObjectId;

  @Prop({ type: [String], default: [] })
  permissions: string[];
}

export const adminSchema = SchemaFactory.createForClass(Admin);
