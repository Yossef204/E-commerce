import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type TSession = Session & Document;

@Schema({ timestamps: true })
export class Session {
  _id: Types.ObjectId;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true })
  refreshTokenHash: string;

  @Prop({ type: String, default: null })
  deviceInfo: string;

  @Prop({ type: String, default: null })
  ipAddress: string;

  @Prop({ type: Boolean, default: false, index: true })
  isRevoked: boolean;

  @Prop({ type: Date, required: true, index: { expires: 0 } })
  expiresAt: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// Additional compound index for fast active session lookup per user
SessionSchema.index({ userId: 1, isRevoked: 1 });

