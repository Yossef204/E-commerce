import { GenderEnum } from '../enums/gender';
import { RolesEnum } from '../enums/roles';
import { AccountStatusEnum } from '../enums/account-status';
import { Types } from 'mongoose';

export interface IUser {
  _id?: Types.ObjectId;
  userName: string;
  phoneNumber: string;
  email: string;
  password: string;
  profilePic?: string;
  role?: RolesEnum;
  status?: AccountStatusEnum;
  isEmailVerified?: boolean;
  emailVerificationOtpHash?: string | null;
  emailVerificationOtpExpiresAt?: Date | null;
}

export interface IAdmin extends IUser {
  isActive?: boolean;
}

export interface ISeller extends IUser {}

export interface ICustomer extends IUser {
  address?: string;
  gender?: GenderEnum;
}
