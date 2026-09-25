import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Types } from 'mongoose';

export interface IPermission {
  _id?: Types.ObjectId;
  userId: Types.ObjectId;
  permissions: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

@Schema({ timestamps: true })
export class Permission {
  id: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: [String] })
  permissions: string[];
}

export const permissionSchema = SchemaFactory.createForClass(Permission);
