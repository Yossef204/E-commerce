import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { RolesEnum } from '../../common/enums/roles';
import { AccountStatusEnum } from '../../common/enums/account-status';

export type TUser = User & Document;

@Schema({ timestamps: true, discriminatorKey: 'role' })
export class User {
  _id: Types.ObjectId;

  @Prop({ type: String, minlength: 3, required: true })
  userName: string;

  @Prop({ type: String })
  phoneNumber: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  })
  email: string;

  @Prop({ type: String, required: true })
  password: string;

  @Prop({ type: String, default: null })
  profilePic: string;

  @Prop({
    type: String,
    enum: Object.values(RolesEnum),
    default: RolesEnum.CUSTOMER,
  })
  role: RolesEnum;

  @Prop({
    type: String,
    enum: Object.values(AccountStatusEnum),
    default: AccountStatusEnum.ACTIVE,
  })
  status: AccountStatusEnum;

  @Prop({ type: Boolean, default: false })
  isEmailVerified: boolean;

  @Prop({ type: String, default: null })
  emailVerificationOtpHash: string | null;

  @Prop({ type: Date, default: null })
  emailVerificationOtpExpiresAt: Date | null;
}

export const userSchema = SchemaFactory.createForClass(User);

// Compound indexes
userSchema.index({ email: 1, status: 1 });
userSchema.index({ email: 1, role: 1 });
