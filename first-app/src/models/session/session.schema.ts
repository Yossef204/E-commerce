import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { Document, Types } from 'mongoose';

export type TSession = Session & Document;

@Schema({ timestamps: true })
export class Session {
  _id: Types.ObjectId;

  @Prop({
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ type: String, default: null })
  refreshTokenHash?: string;

  @Prop({ type: String, required: true, index: true })
  activeTokenHash: string;

  @Prop({ type: [String], default: [], index: true })
  consumedTokenHashes: string[];

  @Prop({ type: String, default: null })
  revocationReason: string | null;

  @Prop({ type: String, default: null })
  deviceInfo: string;

  @Prop({ type: String, default: null })
  ipAddress: string;

  @Prop({ type: String, default: null })
  userAgent: string;

  @Prop({ type: Boolean, default: false, index: true })
  isRevoked: boolean;

  @Prop({ type: Date, required: true, index: { expires: 0 } })
  expiresAt: Date;
}

export const SessionSchema = SchemaFactory.createForClass(Session);

// High-performance compound indexes for active session lookup and RTR reuse checks
SessionSchema.index({ activeTokenHash: 1, isRevoked: 1 });
SessionSchema.index({ consumedTokenHashes: 1 });
SessionSchema.index({ userId: 1, isRevoked: 1 });
