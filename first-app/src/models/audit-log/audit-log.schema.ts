import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';
import { IAuditLog } from '../../common/interfaces/audit-log.interface';

export type TAuditLog = IAuditLog & Document;

@Schema({ timestamps: true })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  @Prop({ required: true, enum: AuditActionEnum, type: String })
  action: AuditActionEnum;

  @Prop({ required: true, type: String })
  targetEntity: string;

  @Prop({ required: true, type: String })
  targetId: string;

  @Prop({ type: Object })
  previousState?: Record<string, any>;

  @Prop({ type: Object })
  newState?: Record<string, any>;

  @Prop({ type: String })
  ipAddress?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ targetEntity: 1, targetId: 1 });
AuditLogSchema.index({ actorId: 1, createdAt: -1 });
