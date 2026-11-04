import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ValidationPipe, ArgumentMetadata } from '@nestjs/common';
import { RegisterSellerAuthDto } from '../dto/register-seller-auth.dto';
import { RolesEnum } from '../../../common/enums/roles';
import { EntityTypeEnum } from '../../../common/enums/entity-type.enum';
import { EntityStatusEnum } from '../../../common/enums/entity-status.enum';
import { AuthService } from '../auth.service';
import { Test, TestingModule } from '@nestjs/testing';
import { UserRepo } from '../../../models/user/user.repository';
import { SellingEntityRepo } from '../../../models/selling-entity/selling-entity.repository';
import { CustomerRepo } from '../../../models/customer/customer.repository';
import { SessionRepo } from '../../../models/session/session.repository';
import { PermissionRepo } from '../../../models/permission/permission.repository';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_SERVICE } from '../../../shared/cache/interfaces/cache-service.interface';
import { MAILER_SERVICE } from '../../../shared/mailer/interfaces/mailer.interface';
import { Types } from 'mongoose';

describe('Seller Registration DTO & Validation Pipeline (Strict RolesEnum Driven)', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const metadata: ArgumentMetadata = {
    type: 'body',
    metatype: RegisterSellerAuthDto,
  };

  const validBaseMerchant = {
    userName: 'Kareem Merchant',
    email: 'kareem@merchant.com',
    password: 'SecurePassword123!',
    phoneNumber: '+201012345678',
    storeName: 'Kareem Electronics',
    description: 'Selling consumer electronics',
  };

  describe('1. Class-Validator Conditional Validation (ValidateIf strictly on role)', () => {
    it('1.1. Should pass validation for SELLER without tax number or documentUrl', async () => {
      const dto = plainToInstance(RegisterSellerAuthDto, {
        ...validBaseMerchant,
        role: RolesEnum.SELLER,
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('1.2. Should pass validation for SELLER even if tax number or documentUrl are optionally provided', async () => {
      const dto = plainToInstance(RegisterSellerAuthDto, {
        ...validBaseMerchant,
        role: RolesEnum.SELLER,
        taxOrCommercialNumber: 'OPTIONAL-12345',
        documentUrl: 'https://example.com/id.pdf',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('1.3. Should fail validation for COMPANY_ADMIN if taxOrCommercialNumber is missing', async () => {
      const dto = plainToInstance(RegisterSellerAuthDto, {
        ...validBaseMerchant,
        role: RolesEnum.COMPANY_ADMIN,
        documentUrl: 'https://example.com/commercial_register.pdf',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const taxError = errors.find((e) => e.property === 'taxOrCommercialNumber');
      expect(taxError).toBeDefined();
      expect(taxError?.constraints?.isNotEmpty).toBe('الرقم الضريبي أو السجل التجاري مطلوب للشركات');
    });

    it('1.4. Should fail validation for COMPANY_ADMIN if documentUrl is missing', async () => {
      const dto = plainToInstance(RegisterSellerAuthDto, {
        ...validBaseMerchant,
        role: RolesEnum.COMPANY_ADMIN,
        taxOrCommercialNumber: 'CR-99887766',
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const docError = errors.find((e) => e.property === 'documentUrl');
      expect(docError).toBeDefined();
      expect(docError?.constraints?.isNotEmpty).toBe('مستند السجل التجاري مطلوب للشركات');
    });

    it('1.5. Should pass validation for COMPANY_ADMIN when all corporate compliance fields are provided', async () => {
      const dto = plainToInstance(RegisterSellerAuthDto, {
        ...validBaseMerchant,
        role: RolesEnum.COMPANY_ADMIN,
        taxOrCommercialNumber: 'TAX-REG-10203040',
        documentUrl: 'https://cdn.marketplace.com/legal/tax_card.pdf',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('1.6. Should reject unauthorized roles (e.g. customer, admin)', async () => {
      const dto = plainToInstance(RegisterSellerAuthDto, {
        ...validBaseMerchant,
        role: 'customer' as any,
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const roleError = errors.find((e) => e.property === 'role');
      expect(roleError).toBeDefined();
      expect(roleError?.constraints?.isIn).toContain('الدور المطلوب يجب أن يكون seller أو company_admin فقط');
    });
  });

  describe('2. ValidationPipe Pipeline Execution', () => {
    it('2.1. Transforms and passes valid SELLER payload with lowercase string', async () => {
      const payload = {
        ...validBaseMerchant,
        role: 'seller',
      };

      const result = await pipe.transform(payload, metadata);
      expect(result).toBeInstanceOf(RegisterSellerAuthDto);
      expect(result.role).toBe(RolesEnum.SELLER);
      expect(result.taxOrCommercialNumber).toBeUndefined();
    });

    it('2.2. Throws BadRequestException for COMPANY_ADMIN payload missing taxOrCommercialNumber', async () => {
      const payload = {
        ...validBaseMerchant,
        role: 'company_admin',
        documentUrl: 'https://example.com/doc.pdf',
      };

      await expect(pipe.transform(payload, metadata)).rejects.toThrow();
    });

    it('2.3. Throws BadRequestException for COMPANY_ADMIN payload missing documentUrl', async () => {
      const payload = {
        ...validBaseMerchant,
        role: 'company_admin',
        taxOrCommercialNumber: '123-456',
      };

      await expect(pipe.transform(payload, metadata)).rejects.toThrow();
    });
  });

  describe('3. AuthService.registerSeller Tier Resolution based on Role', () => {
    let authService: AuthService;
    let sellingEntityRepoMock: any;
    let userRepoMock: any;

    beforeEach(async () => {
      sellingEntityRepoMock = {
        getOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((data) =>
          Promise.resolve({ _id: new Types.ObjectId(), ...data }),
        ),
        updateOne: jest.fn().mockResolvedValue({}),
      };

      userRepoMock = {
        getOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation((data) =>
          Promise.resolve({
            _id: new Types.ObjectId(),
            ...data,
            toObject() {
              const { toObject, ...rest } = this;
              return rest;
            },
          }),
        ),
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: UserRepo, useValue: userRepoMock },
          { provide: SellingEntityRepo, useValue: sellingEntityRepoMock },
          { provide: CustomerRepo, useValue: { getOne: jest.fn() } },
          { provide: SessionRepo, useValue: { updateMany: jest.fn() } },
          { provide: PermissionRepo, useValue: { upsertUserPermissions: jest.fn() } },
          { provide: JwtService, useValue: { signAsync: jest.fn() } },
          { provide: ConfigService, useValue: { get: jest.fn() } },
          { provide: CACHE_SERVICE, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
          { provide: MAILER_SERVICE, useValue: { send: jest.fn().mockResolvedValue(undefined) } },
        ],
      }).compile();

      authService = module.get<AuthService>(AuthService);
    });

    it('3.1. Resolves SELLER role to INDEPENDENT_SELLER type and null tax details', async () => {
      const dto: RegisterSellerAuthDto = {
        ...validBaseMerchant,
        role: RolesEnum.SELLER,
      };

      const response = await authService.registerSeller(dto);

      expect(response.message).toContain('تم تسجيل المتجر بنجاح');
      expect(sellingEntityRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EntityTypeEnum.INDEPENDENT_SELLER,
          status: EntityStatusEnum.PENDING_APPROVAL,
          documentUrl: null,
          businessDetails: expect.objectContaining({
            taxNumber: null,
            commercialRegister: null,
          }),
        }),
      );
    });

    it('3.2. Resolves COMPANY_ADMIN role to COMPANY type and stored commercial details', async () => {
      const dto: RegisterSellerAuthDto = {
        ...validBaseMerchant,
        role: RolesEnum.COMPANY_ADMIN,
        taxOrCommercialNumber: 'TAX-998877',
        documentUrl: 'https://cdn.example.com/company_cr.pdf',
      };

      const response = await authService.registerSeller(dto);

      expect(response.message).toContain('تم تسجيل المتجر بنجاح');
      expect(sellingEntityRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: EntityTypeEnum.COMPANY,
          status: EntityStatusEnum.PENDING_APPROVAL,
          documentUrl: 'https://cdn.example.com/company_cr.pdf',
          businessDetails: expect.objectContaining({
            taxNumber: 'TAX-998877',
            commercialRegister: 'TAX-998877',
          }),
        }),
      );
    });
  });
});
