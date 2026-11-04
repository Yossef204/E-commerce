import { Test, TestingModule } from '@nestjs/testing';
import { Reflector, APP_INTERCEPTOR } from '@nestjs/core';
import { Types } from 'mongoose';
import { from } from 'rxjs';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getConnectionToken } from '@nestjs/mongoose';

import { AuditActionEnum } from '../src/common/enums/audit-action.enum';
import { AuditLogInterceptor } from '../src/common/interceptors/audit-log.interceptor';
import { AuditService } from '../src/modules/audit/audit.service';
import { AuditController } from '../src/modules/audit/audit.controller';
import { AuditLogRepo } from '../src/models/audit-log/audit-log.repository';

import { BrandController } from '../src/modules/brand/brand.controller';
import { BrandService } from '../src/modules/brand/brand.service';
import { BrandFactory } from '../src/modules/brand/factory/brand.factory';

import { ProductController } from '../src/modules/product/product.controller';
import { ProductService } from '../src/modules/product/product.service';

import { CategoryController } from '../src/modules/category/category.controller';
import { CategoryService } from '../src/modules/category/category.service';
import { CategoryFactory } from '../src/modules/category/factory/category.factory';

import { OrderController } from '../src/modules/order/order.controller';
import { OrderService } from '../src/modules/order/order.service';
import { PaymentContext } from '../src/shared/payment/context/payment.context';
import { CheckoutSagaService } from '../src/shared/payment/saga/checkout.saga';

import { CouponController } from '../src/modules/coupon/coupon.controller';
import { CouponService } from '../src/modules/coupon/coupon.service';

import { SellingEntityController } from '../src/modules/selling-entity/selling-entity.controller';
import { MerchantController } from '../src/modules/selling-entity/merchant.controller';
import { SellingEntityService } from '../src/modules/selling-entity/selling-entity.service';

import { UserController } from '../src/modules/user/user.controller';
import { UserService } from '../src/modules/user/user.service';

describe('System-Wide Audit Logging Across Core Domain Modules (E2E)', () => {
  let auditLogStore: any[] = [];
  let auditService: AuditService;
  let auditController: AuditController;
  let interceptor: AuditLogInterceptor;
  let reflector: Reflector;

  // Domain Controllers
  let brandController: BrandController;
  let productController: ProductController;
  let categoryController: CategoryController;
  let orderController: OrderController;
  let couponController: CouponController;
  let sellingEntityController: SellingEntityController;
  let merchantController: MerchantController;
  let userController: UserController;

  const actorObjectId = new Types.ObjectId('6abaa7508528c65b5d341a95');
  const actorIdStr = actorObjectId.toString();

  const auditLogRepoMock = {
    create: jest.fn().mockImplementation(async (data: any) => {
      const record = {
        _id: new Types.ObjectId(),
        ...data,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      auditLogStore.push(record);
      return record;
    }),
    getAll: jest.fn().mockImplementation(async (filter: any) => {
      return auditLogStore.filter((log) => {
        if (filter.targetEntity) {
          if (filter.targetEntity instanceof RegExp) {
            if (!filter.targetEntity.test(log.targetEntity)) return false;
          } else if (log.targetEntity !== filter.targetEntity) {
            return false;
          }
        }
        if (filter.targetId && log.targetId !== filter.targetId) {
          return false;
        }
        if (filter.actorId && log.actorId.toString() !== filter.actorId.toString()) {
          return false;
        }
        return true;
      });
    }),
  };

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        AuditController,
        BrandController,
        ProductController,
        CategoryController,
        OrderController,
        CouponController,
        SellingEntityController,
        MerchantController,
        UserController,
      ],
      providers: [
        AuditService,
        AuditLogInterceptor,
        Reflector,
        {
          provide: JwtService,
          useValue: { verifyAsync: jest.fn(), signAsync: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue('mock_jwt_secret') },
        },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        {
          provide: getConnectionToken(),
          useValue: { readyState: 1 },
        },
        {
          provide: AuditLogRepo,
          useValue: auditLogRepoMock,
        },
        {
          provide: BrandService,
          useValue: {
            create: jest.fn().mockResolvedValue({ _id: 'brand_001', name: 'Nike' }),
            update: jest.fn().mockResolvedValue({ _id: 'brand_001', name: 'Nike Updated' }),
            remove: jest.fn().mockResolvedValue({ deleted: true }),
          },
        },
        {
          provide: BrandFactory,
          useValue: {
            createBrand: jest.fn().mockImplementation((dto) => dto),
          },
        },
        {
          provide: ProductService,
          useValue: {
            createProduct: jest.fn().mockResolvedValue({ _id: 'prod_101', name: 'Air Max' }),
            updateProduct: jest.fn().mockResolvedValue({ _id: 'prod_101', price: 150 }),
            deleteProduct: jest.fn().mockResolvedValue({ deleted: true }),
            updateApprovalStatus: jest.fn().mockResolvedValue({ _id: 'prod_101', approvalStatus: 'APPROVED' }),
            updateInventoryStock: jest.fn().mockResolvedValue({ productId: 'prod_101', stock: 50 }),
          },
        },
        {
          provide: CategoryService,
          useValue: {
            create: jest.fn().mockResolvedValue({ _id: 'cat_201', name: 'Shoes' }),
            update: jest.fn().mockResolvedValue({ _id: 'cat_201', name: 'Footwear' }),
            remove: jest.fn().mockResolvedValue({ deleted: true }),
          },
        },
        {
          provide: CategoryFactory,
          useValue: {
            createCategory: jest.fn().mockImplementation((dto) => dto),
          },
        },
        {
          provide: OrderService,
          useValue: {
            checkout: jest.fn().mockResolvedValue({ _id: 'order_301', status: 'PENDING' }),
            updateEntityOrderStatus: jest.fn().mockResolvedValue({ _id: 'eo_302', status: 'PROCESSING' }),
            cancelMyOrder: jest.fn().mockResolvedValue({ _id: 'order_301', status: 'CANCELLED' }),
          },
        },
        {
          provide: PaymentContext,
          useValue: {
            getAvailablePaymentMethods: jest.fn().mockReturnValue(['COD']),
          },
        },
        {
          provide: CheckoutSagaService,
          useValue: {},
        },
        {
          provide: CouponService,
          useValue: {
            createVendorCoupon: jest.fn().mockResolvedValue({ _id: 'coup_401', code: 'VENDOR10' }),
            createPlatformCoupon: jest.fn().mockResolvedValue({ _id: 'coup_402', code: 'GLOBAL20' }),
            updateCouponStatus: jest.fn().mockResolvedValue({ _id: 'coup_401', isActive: false }),
          },
        },
        {
          provide: SellingEntityService,
          useValue: {
            registerCompany: jest.fn().mockResolvedValue({ _id: 'entity_501', companyName: 'Vendor Corp' }),
            registerIndependentSeller: jest.fn().mockResolvedValue({ _id: 'entity_502', name: 'Seller John' }),
            updateStatus: jest.fn().mockResolvedValue({ _id: 'entity_501', status: 'APPROVED' }),
            uploadOnboardingDocuments: jest.fn().mockResolvedValue({ success: true }),
          },
        },
        {
          provide: UserService,
          useValue: {
            updateProfile: jest.fn().mockResolvedValue({ _id: actorIdStr, name: 'Admin Jane' }),
            changePassword: jest.fn().mockResolvedValue({ success: true, message: 'Password changed' }),
            updateProfilePic: jest.fn().mockResolvedValue({ _id: actorIdStr, profilePic: 'https://cdn.example.com/pic.jpg' }),
          },
        },
      ],
    }).compile();

    auditService = module.get<AuditService>(AuditService);
    auditController = module.get<AuditController>(AuditController);
    interceptor = module.get<AuditLogInterceptor>(AuditLogInterceptor);
    reflector = module.get<Reflector>(Reflector);

    brandController = module.get<BrandController>(BrandController);
    productController = module.get<ProductController>(ProductController);
    categoryController = module.get<CategoryController>(CategoryController);
    orderController = module.get<OrderController>(OrderController);
    couponController = module.get<CouponController>(CouponController);
    sellingEntityController = module.get<SellingEntityController>(SellingEntityController);
    merchantController = module.get<MerchantController>(MerchantController);
    userController = module.get<UserController>(UserController);
  });

  beforeEach(() => {
    auditLogStore = [];
    jest.clearAllMocks();
  });

  /**
   * Helper that executes a controller method through the AuditLogInterceptor pipeline
   */
  async function executeThroughInterceptor(
    controller: any,
    handler: Function,
    req: any,
    fn: () => any,
  ) {
    const executionContext: any = {
      getHandler: () => handler,
      getClass: () => controller.constructor,
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    };

    const callHandler: any = {
      handle: () => from(Promise.resolve().then(() => fn())),
    };

    const result$ = interceptor.intercept(executionContext, callHandler);
    return new Promise((resolve, reject) => {
      result$.subscribe({
        next: (val) => resolve(val),
        error: (err) => reject(err),
      });
    });
  }

  // =========================================================================
  // 1. BRAND MODULE AUDIT LOGGING
  // =========================================================================
  describe('1. Brand Module Auditing', () => {
    it('should audit Brand CREATE mutation', async () => {
      const req = { user: { id: actorIdStr }, ip: '127.0.0.1', body: { name: 'Nike' } };
      await executeThroughInterceptor(brandController, brandController.create, req, () =>
        brandController.create({ name: 'Nike' } as any),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.CREATE,
          targetEntity: 'Brand',
          targetId: 'brand_001',
        }),
      );
    });

    it('should audit Brand UPDATE mutation', async () => {
      const req = { user: { id: actorIdStr }, ip: '127.0.0.1', params: { id: 'brand_001' }, body: { name: 'Nike Updated' } };
      await executeThroughInterceptor(brandController, brandController.update, req, () =>
        brandController.update('brand_001', { name: 'Nike Updated' } as any),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.UPDATE,
          targetEntity: 'Brand',
          targetId: 'brand_001',
        }),
      );
    });

    it('should audit Brand DELETE mutation', async () => {
      const req = { user: { id: actorIdStr }, ip: '127.0.0.1', params: { id: 'brand_001' } };
      await executeThroughInterceptor(brandController, brandController.remove, req, () =>
        brandController.remove('brand_001'),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.DELETE,
          targetEntity: 'Brand',
          targetId: 'brand_001',
        }),
      );
    });
  });

  // =========================================================================
  // 2. PRODUCT & INVENTORY MODULE AUDIT LOGGING
  // =========================================================================
  describe('2. Product & Inventory Module Auditing', () => {
    it('should audit Product CREATE mutation', async () => {
      const req = { user: { id: actorIdStr }, ip: '127.0.0.1', body: { name: 'Air Max' } };
      await executeThroughInterceptor(productController, productController.createProduct, req, () =>
        productController.createProduct({ name: 'Air Max' } as any, req),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.CREATE,
          targetEntity: 'Product',
          targetId: 'prod_101',
        }),
      );
    });

    it('should audit Product UPDATE mutation', async () => {
      const req = { user: { id: actorIdStr }, ip: '127.0.0.1', params: { id: 'prod_101' }, body: { price: 150 } };
      await executeThroughInterceptor(productController, productController.updateProduct, req, () =>
        productController.updateProduct('prod_101', { price: 150 } as any, req),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.UPDATE,
          targetEntity: 'Product',
          targetId: 'prod_101',
        }),
      );
    });

    it('should audit Product APPROVE status change mutation', async () => {
      const req = { user: { id: actorIdStr }, ip: '127.0.0.1', params: { id: 'prod_101' } };
      await executeThroughInterceptor(productController, productController.approveProduct, req, () =>
        productController.approveProduct('prod_101'),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.APPROVE,
          targetEntity: 'Product',
          targetId: 'prod_101',
        }),
      );
    });

    it('should audit Inventory STOCK_UPDATE mutation', async () => {
      const req = {
        user: { id: actorIdStr },
        ip: '127.0.0.1',
        body: { productId: 'prod_101', stock: 50 },
      };
      await executeThroughInterceptor(productController, productController.updateInventoryStock, req, () =>
        productController.updateInventoryStock({ productId: 'prod_101', stock: 50 } as any, req),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.STOCK_UPDATE,
          targetEntity: 'Inventory',
          targetId: 'prod_101',
        }),
      );
    });
  });

  // =========================================================================
  // 3. CATEGORY MODULE AUDIT LOGGING
  // =========================================================================
  describe('3. Category Module Auditing', () => {
    it('should audit Category CREATE mutation', async () => {
      const req = { user: { id: actorIdStr }, ip: '127.0.0.1', body: { name: 'Shoes' } };
      await executeThroughInterceptor(categoryController, categoryController.create, req, () =>
        categoryController.create({ name: 'Shoes' } as any),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.CREATE,
          targetEntity: 'Category',
          targetId: 'cat_201',
        }),
      );
    });
  });

  // =========================================================================
  // 4. ORDER MODULE AUDIT LOGGING
  // =========================================================================
  describe('4. Order Module Auditing', () => {
    it('should audit Order checkout CREATE mutation', async () => {
      const req = { user: { id: actorIdStr }, ip: '127.0.0.1', body: { items: [] } };
      await executeThroughInterceptor(orderController, orderController.checkout, req, () =>
        orderController.checkout({ items: [] } as any, req),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.CREATE,
          targetEntity: 'Order',
          targetId: 'order_301',
        }),
      );
    });

    it('should audit Order status update mutation', async () => {
      const req = { user: { id: actorIdStr }, ip: '127.0.0.1', params: { id: 'eo_302' }, body: { status: 'PROCESSING' } };
      await executeThroughInterceptor(orderController, orderController.updateEntityOrderStatus, req, () =>
        orderController.updateEntityOrderStatus('eo_302', { status: 'PROCESSING' } as any, req),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.STATUS_CHANGE,
          targetEntity: 'Order',
          targetId: 'eo_302',
        }),
      );
    });

    it('should audit Order cancel mutation', async () => {
      const req = { user: { id: actorIdStr }, ip: '127.0.0.1', params: { id: 'order_301' } };
      await executeThroughInterceptor(orderController, orderController.cancelOrder, req, () =>
        orderController.cancelOrder('order_301', req),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.CANCEL,
          targetEntity: 'Order',
          targetId: 'order_301',
        }),
      );
    });
  });

  // =========================================================================
  // 5. COUPON MODULE AUDIT LOGGING
  // =========================================================================
  describe('5. Coupon Module Auditing', () => {
    it('should audit Coupon CREATE mutation', async () => {
      const req = {
        user: { id: actorIdStr, sellingEntityId: 'entity_501' },
        ip: '127.0.0.1',
        body: { code: 'VENDOR10', discount: 10 },
      };
      await executeThroughInterceptor(couponController, couponController.createVendorCoupon, req, () =>
        couponController.createVendorCoupon(req, { code: 'VENDOR10', discount: 10 } as any),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.CREATE,
          targetEntity: 'Coupon',
          targetId: 'coup_401',
        }),
      );
    });
  });

  // =========================================================================
  // 6. SELLING ENTITY MODULE AUDIT LOGGING
  // =========================================================================
  describe('6. Selling Entity Module Auditing', () => {
    it('should audit SellingEntity company registration mutation', async () => {
      const req = { user: { id: actorIdStr, sub: actorIdStr }, ip: '127.0.0.1', body: { companyName: 'Vendor Corp' } };
      await executeThroughInterceptor(sellingEntityController, sellingEntityController.registerCompany, req, () =>
        sellingEntityController.registerCompany(req, { companyName: 'Vendor Corp' } as any),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.CREATE,
          targetEntity: 'SellingEntity',
          targetId: 'entity_501',
        }),
      );
    });

    it('should audit SellingEntity onboarding documents upload', async () => {
      const req = {
        user: { id: actorIdStr, sub: actorIdStr, sellingEntityId: 'entity_501' },
        ip: '127.0.0.1',
        body: { documentUrl: 'https://cdn.example.com/cr.pdf' },
      };
      await executeThroughInterceptor(merchantController, merchantController.uploadDocuments, req, () =>
        merchantController.uploadDocuments(req, { documentUrl: 'https://cdn.example.com/cr.pdf' }),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.UPDATE_ONBOARDING,
          targetEntity: 'SellingEntity',
          targetId: 'entity_501',
        }),
      );
    });
  });

  // =========================================================================
  // 7. USER MODULE AUDIT LOGGING WITH SENSITIVE DATA REDACTION
  // =========================================================================
  describe('7. User Module Auditing & Redaction', () => {
    it('should audit change password and REDACT password values', async () => {
      const req = {
        user: { id: actorIdStr, sub: actorIdStr },
        ip: '127.0.0.1',
        body: {
          currentPassword: 'superSecretPassword123!',
          newPassword: 'brandNewPassword456@',
        },
      };
      await executeThroughInterceptor(userController, userController.changePassword, req, () =>
        userController.changePassword(req, req.body as any),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.CHANGE_PASSWORD,
          targetEntity: 'User',
          targetId: actorIdStr,
          previousState: {
            currentPassword: '[REDACTED]',
            newPassword: '[REDACTED]',
          },
        }),
      );
    });

    it('should audit update user profile', async () => {
      const req = {
        user: { id: actorIdStr, sub: actorIdStr },
        ip: '127.0.0.1',
        body: { name: 'Admin Jane' },
      };
      await executeThroughInterceptor(userController, userController.updateProfile, req, () =>
        userController.updateProfile(req, { name: 'Admin Jane' } as any),
      );

      expect(auditLogRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: actorObjectId,
          action: AuditActionEnum.UPDATE_PROFILE,
          targetEntity: 'User',
          targetId: actorIdStr,
        }),
      );
    });
  });

  // =========================================================================
  // 8. AUDIT LOG QUERY ENDPOINTS (TRACEABILITY VERIFICATION)
  // =========================================================================
  describe('8. Traceability Query Endpoints', () => {
    beforeEach(() => {
      // Seed audit store with multiple entries across different entities & actors
      auditLogStore = [
        {
          _id: new Types.ObjectId(),
          actorId: actorObjectId,
          action: AuditActionEnum.CREATE,
          targetEntity: 'Brand',
          targetId: 'brand_001',
          createdAt: new Date(),
        },
        {
          _id: new Types.ObjectId(),
          actorId: actorObjectId,
          action: AuditActionEnum.CREATE,
          targetEntity: 'Product',
          targetId: 'prod_101',
          createdAt: new Date(),
        },
        {
          _id: new Types.ObjectId(),
          actorId: new Types.ObjectId('6abac730cfd5b2ef7df27055'),
          action: AuditActionEnum.STOCK_UPDATE,
          targetEntity: 'Inventory',
          targetId: 'prod_101',
          createdAt: new Date(),
        },
      ];
    });

    it('should retrieve audit logs by targetEntity (GET /audit-logs/entity/{targetEntity})', async () => {
      const result = await auditController.getLogsByEntity('Brand');
      expect(result).toHaveLength(1);
      expect(result[0].targetEntity).toBe('Brand');
      expect(result[0].targetId).toBe('brand_001');
    });

    it('should support case-insensitive targetEntity queries (brand vs Brand)', async () => {
      const result = await auditController.getLogsByEntity('brand');
      expect(result).toHaveLength(1);
      expect(result[0].targetEntity).toBe('Brand');
    });

    it('should retrieve audit logs by actorId (GET /audit-logs/actor/{actorId})', async () => {
      const result = await auditController.getLogsByActor(actorIdStr);
      expect(result).toHaveLength(2);
      expect(result.every((r) => r.actorId.toString() === actorIdStr)).toBe(true);
    });

    it('should return empty list gracefully when actorId is invalid', async () => {
      const result = await auditController.getLogsByActor('invalid-actor-id');
      expect(result).toEqual([]);
    });
  });
});
