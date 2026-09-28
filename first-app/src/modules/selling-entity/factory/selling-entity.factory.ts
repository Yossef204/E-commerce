import { Injectable } from '@nestjs/common';
import { Types } from 'mongoose';
import { CreateCompanyDto } from '../dto/create-company.dto';
import { CreateIndependentSellerDto } from '../dto/create-independent-seller.dto';
import { SellingEntity } from '../../../models/selling-entity/selling-entity.schema';
import { EntityTypeEnum } from '../../../common/enums/entity-type.enum';
import { EntityStatusEnum } from '../../../common/enums/entity-status.enum';

@Injectable()
export class SellingEntityFactory {
  createCompanyEntity(
    ownerId: Types.ObjectId,
    createCompanyDto: CreateCompanyDto,
  ): SellingEntity {
    const entity = new SellingEntity();
    entity.legalName = createCompanyDto.legalName.trim();
    entity.type = EntityTypeEnum.COMPANY;
    entity.status = EntityStatusEnum.PENDING_APPROVAL;
    entity.primaryOwnerId = ownerId;
    entity.businessDetails = {
      taxNumber: createCompanyDto.taxNumber,
      commercialRegister: createCompanyDto.commercialRegister,
      phone: createCompanyDto.phone,
      address: createCompanyDto.address,
    };
    return entity;
  }

  createIndependentSellerEntity(
    ownerId: Types.ObjectId,
    createIndependentSellerDto: CreateIndependentSellerDto,
  ): SellingEntity {
    const entity = new SellingEntity();
    entity.legalName = createIndependentSellerDto.legalName.trim();
    entity.type = EntityTypeEnum.INDEPENDENT_SELLER;
    entity.status = EntityStatusEnum.APPROVED;
    entity.primaryOwnerId = ownerId;
    entity.businessDetails = {
      taxNumber: createIndependentSellerDto.taxNumber,
      commercialRegister: undefined,
      phone: createIndependentSellerDto.phone,
      address: createIndependentSellerDto.address,
    };
    return entity;
  }
}
