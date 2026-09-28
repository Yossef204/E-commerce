import { Types } from 'mongoose';
import { EntityTypeEnum } from '../enums/entity-type.enum';
import { EntityStatusEnum } from '../enums/entity-status.enum';

export interface IBusinessDetails {
  taxNumber?: string;
  commercialRegister?: string;
  phone?: string;
  address?: string;
}

export interface ISellingEntity {
  _id?: Types.ObjectId;
  legalName: string;
  type: EntityTypeEnum;
  status?: EntityStatusEnum;
  primaryOwnerId: Types.ObjectId;
  businessDetails?: IBusinessDetails;
  rejectionReason?: string;
}
