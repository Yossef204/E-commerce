import { Test, TestingModule } from '@nestjs/testing';
import {
  ForbiddenException,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';

import { AuthService } from '../../auth/auth.service';
import { AuthController } from '../../auth/auth.controller';
import { ProductController } from '../../product/product.controller';
import { ProductService } from '../../product/product.service';
import { OrderController } from '../../order/order.controller';
import { OrderService } from '../../order/order.service';
import { SellerPayoutController } from '../../seller-payout/seller-payout.controller';
import { SellerPayoutService } from '../../seller-payout/seller-payout.service';
import { MerchantController } from '../merchant.controller';
import { SellingEntityService } from '../selling-entity.service';
import { AdminSellerService } from '../../admin/services/admin-seller.service';

import { AuthenticationGuard } from '../../../common/guards/authentication.guard';
import { ApprovedEntityGuard } from '../../../common/guards/approved-entity.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';

import { RolesEnum } from '../../../common/enums/roles';
import { EntityStatusEnum } from '../../../common/enums/entity-status.enum';
import { Permission } from '../../../common/enums/permission.enum';
import { UserRepo } from '../../../models/user/user.repository';
import { SellingEntityRepo } from '../../../models/selling-entity/selling-entity.repository';
import { SessionRepo } from '../../../models/session/session.repository';
import { BrandRepo } from '../../../models/brand/brand.repository';
import { PermissionRepo } from '../../../models/permission/permission.repository';
import { ProductRepo } from '../../../models/product/product.repository';
import { EntityOrderRepo } from '../../../models/order/entity-order.repository';
import { EscrowRepo } from '../../../models/escrow/escrow.repository';
import { PayoutRepo } from '../../../models/payout/payout.repository';
import { CustomerRepo } from '../../../models/customer/customer.repository';
import { CACHE_SERVICE } from '../../../shared/cache/interfaces/cache-service.interface';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { MAILER_SERVICE } from '../../../shared/mailer/interfaces/mailer.interface';
import { PaymentContext } from '../../../shared/payment/context/payment.context';
import { CheckoutSagaService } from '../../../shared/payment/saga/checkout.saga';
import { SellingEntityFactory } from '../factory/selling-entity.factory';
import { getConnectionToken } from '@nestjs/mongoose';

describe('Merchant Authorization and Entity Lifecycle Guarding (Integration Spec)', () => {
  let authService: AuthService;
  let authController: AuthController;
  let productController: ProductController;
  let productService: ProductService;
  let orderController: OrderController;
  let orderService: OrderService;
  let sellerPayoutController: SellerPayoutController;
  let sellerPayoutService: SellerPayoutService;
  let merchantController: MerchantController;
  let sellingEntityService: SellingEntityService;
  let adminSellerService: AdminSellerService;

  let authGuard: AuthenticationGuard;
  let approvedEntityGuard: ApprovedEntityGuard;
  let permissionsGuard: PermissionsGuard;
  let jwtService: JwtService;
  let reflector: Reflector;

  const JWT_SECRET = 'merchant_lifecycle_security_jwt_secret_2026';

  let inMemoryCache: Map<string, any>;
  let userStore: Map<string, any>;
  let entityStore: Map<string, any>;
  let sessionStore: any[];
  let permissionStore: Map<string, any>;
  let productStore: any[];
  let brandStore: any[];

  // Helper to execute guard pipeline matching AppModule global sequence
  async function runGuardPipeline(
    token: string | null,
    handler: Function,
    controllerClass: Function,
    extraHeaders: Record<string, string> = {},
  ): Promise<{ req: any }> {
    const req: any = {
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...extraHeaders,
      },
      user: null,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
      getHandler: () => handler,
      getClass: () => controllerClass,
      getArgs: () => [req],
      getArgByIndex: () => req,
      switchToRpc: () => ({}) as any,
      switchToWs: () => ({}) as any,
      getType: () => 'http',
    } as unknown as ExecutionContext;

    // 1. AuthenticationGuard
    await authGuard.canActivate(context);

    // 2. ApprovedEntityGuard
    await approvedEntityGuard.canActivate(context);

    // 3. PermissionsGuard
    await permissionsGuard.canActivate(context);

    return { req };
  }

  beforeAll(async () => {
    inMemoryCache = new Map<string, any>();
    userStore = new Map<string, any>();
    entityStore = new Map<string, any>();
    sessionStore = [];
    permissionStore = new Map<string, any>();
    productStore = [];
    brandStore = [];

    const cacheServiceMock = {
      get: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve(inMemoryCache.has(key) ? inMemoryCache.get(key) : null);
      }),
      set: jest.fn().mockImplementation((key: string, value: any, ttl?: number) => {
        inMemoryCache.set(key, value);
        return Promise.resolve();
      }),
      del: jest.fn().mockImplementation((key: string) => {
        inMemoryCache.delete(key);
        return Promise.resolve();
      }),
    };

    const mailerServiceMock = {
      send: jest.fn().mockResolvedValue(true),
    };

    const configServiceMock = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_SECRET') return JWT_SECRET;
        if (key === 'jwt') return { accessSecret: JWT_SECRET };
        return null;
      }),
    };

    const userRepoMock = {
      getOne: jest.fn().mockImplementation((query: any) => {
        for (const u of userStore.values()) {
          if (query.email && u.email === query.email.toLowerCase()) return Promise.resolve({ ...u });
          if (query._id && u._id.toString() === query._id.toString()) return Promise.resolve({ ...u });
        }
        return Promise.resolve(null);
      }),
      getAll: jest.fn().mockImplementation((query: any) => {
        const results: any[] = [];
        for (const u of userStore.values()) {
          if (query.sellingEntityId && u.sellingEntityId?.toString() === query.sellingEntityId.toString()) {
            results.push({ ...u });
          }
        }
        return Promise.resolve(results);
      }),
      create: jest.fn().mockImplementation((data: any) => {
        const _id = data._id || new Types.ObjectId();
        const doc = { ...data, _id, tokenVersion: data.tokenVersion || 1 };
        userStore.set(_id.toString(), doc);
        userStore.set(doc.email, doc);
        return Promise.resolve(doc);
      }),
      updateOne: jest.fn().mockImplementation((filter: any, update: any) => {
        for (const [key, u] of userStore.entries()) {
          if (
            (filter._id && u._id.toString() === filter._id.toString()) ||
            (filter.email && u.email === filter.email)
          ) {
            let updated = { ...u };
            if (update.$inc?.tokenVersion) {
              updated.tokenVersion = (updated.tokenVersion || 1) + update.$inc.tokenVersion;
            }
            if (update.$set) {
              updated = { ...updated, ...update.$set };
            }
            updated = { ...updated, ...update };
            delete (updated as any).$inc;
            delete (updated as any).$set;
            userStore.set(key, updated);
            userStore.set(updated.email, updated);
            userStore.set(updated._id.toString(), updated);
            return Promise.resolve(updated);
          }
        }
        return Promise.resolve(null);
      }),
    };

    const sellingEntityRepoMock = {
      getOne: jest.fn().mockImplementation((query: any) => {
        for (const e of entityStore.values()) {
          if (query._id && e._id.toString() === query._id.toString()) return Promise.resolve({ ...e });
          if (query.primaryOwnerId && e.primaryOwnerId?.toString() === query.primaryOwnerId.toString()) {
            return Promise.resolve({ ...e });
          }
          if (query.$or) {
            for (const orCond of query.$or) {
              if (orCond.legalName && e.legalName?.toLowerCase() === orCond.legalName.source?.replace(/^\^|\$$/g, '').toLowerCase()) {
                return Promise.resolve({ ...e });
              }
            }
          }
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation((data: any) => {
        const _id = data._id || new Types.ObjectId();
        const doc = { ...data, _id, status: data.status || EntityStatusEnum.PENDING_APPROVAL };
        entityStore.set(_id.toString(), doc);
        return Promise.resolve(doc);
      }),
      updateOne: jest.fn().mockImplementation((filter: any, update: any) => {
        for (const [key, e] of entityStore.entries()) {
          if (filter._id && e._id.toString() === filter._id.toString()) {
            let updated = { ...e };
            if (update.$set) {
              updated = { ...updated, ...update.$set };
            }
            updated = { ...updated, ...update };
            delete (updated as any).$set;
            entityStore.set(key, updated);
            return Promise.resolve(updated);
          }
        }
        return Promise.resolve(null);
      }),
    };

    const sessionRepoMock = {
      create: jest.fn().mockImplementation((data: any) => {
        const doc = { ...data, _id: new Types.ObjectId() };
        sessionStore.push(doc);
        return Promise.resolve(doc);
      }),
      getOne: jest.fn().mockImplementation((query: any) => {
        for (const s of sessionStore) {
          if (query._id && s._id.toString() === query._id.toString()) return Promise.resolve({ ...s });
          if (query.userId && s.userId.toString() === query.userId.toString()) {
            if (query.activeTokenHash && s.activeTokenHash === query.activeTokenHash) return Promise.resolve({ ...s });
            return Promise.resolve({ ...s });
          }
        }
        return Promise.resolve(null);
      }),
      updateOne: jest.fn().mockImplementation((filter: any, update: any) => {
        for (const s of sessionStore) {
          if (filter._id && s._id.toString() === filter._id.toString()) {
            Object.assign(s, update.$set || update);
            return Promise.resolve(s);
          }
        }
        return Promise.resolve(null);
      }),
    };

    const permissionRepoMock = {
      getOne: jest.fn().mockImplementation((query: any) => {
        const p = permissionStore.get(query.userId);
        return Promise.resolve(p ? { ...p } : null);
      }),
      upsertUserPermissions: jest.fn().mockImplementation((userId: string, perms: string[]) => {
        permissionStore.set(userId, { userId, permissions: perms });
        return Promise.resolve({ userId, permissions: perms });
      }),
    };

    const brandRepoMock = {
      getOne: jest.fn().mockImplementation((query: any) => {
        for (const b of brandStore) {
          if (query.sellingEntityId && b.sellingEntityId?.toString() === query.sellingEntityId.toString()) {
            return Promise.resolve({ ...b });
          }
        }
        return Promise.resolve(null);
      }),
      create: jest.fn().mockImplementation((data: any) => {
        const doc = { ...data, _id: new Types.ObjectId() };
        brandStore.push(doc);
        return Promise.resolve(doc);
      }),
      updateMany: jest.fn().mockImplementation((filter: any, update: any) => {
        let count = 0;
        for (const b of brandStore) {
          if (filter.sellingEntityId && b.sellingEntityId?.toString() === filter.sellingEntityId.toString()) {
            Object.assign(b, update);
            count++;
          }
        }
        return Promise.resolve({ modifiedCount: count });
      }),
    };

    const productRepoMock = {
      create: jest.fn().mockImplementation((data: any) => {
        const doc = { ...data, _id: new Types.ObjectId() };
        productStore.push(doc);
        return Promise.resolve(doc);
      }),
    };

    const entityOrderRepoMock = {
      getAll: jest.fn().mockResolvedValue([]),
    };

    const escrowRepoMock = {
      getAll: jest.fn().mockResolvedValue([]),
    };

    const payoutRepoMock = {
      create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId(), status: 'PENDING' }),
      getAll: jest.fn().mockResolvedValue([]),
    };

    const customerRepoMock = {
      create: jest.fn().mockResolvedValue({}),
      getOne: jest.fn().mockResolvedValue(null),
    };

    const connectionMock = {
      models: {
        User: {
          findById: jest.fn().mockImplementation((id: any) => ({
            lean: () => Promise.resolve(userStore.get(id.toString())),
          })),
          find: jest.fn().mockImplementation((query: any) => ({
            select: () => ({
              lean: () => {
                const results: any[] = [];
                for (const u of userStore.values()) {
                  if (query.sellingEntityId && u.sellingEntityId?.toString() === query.sellingEntityId.toString()) {
                    results.push(u);
                  }
                }
                return Promise.resolve(results);
              },
            }),
          })),
        },
        SellingEntity: {
          findById: jest.fn().mockImplementation((id: any) => ({
            select: () => ({
              lean: () => Promise.resolve(entityStore.get(id.toString())),
            }),
            lean: () => Promise.resolve(entityStore.get(id.toString())),
          })),
          findOne: jest.fn().mockImplementation((query: any) => ({
            select: () => ({
              lean: () => {
                for (const e of entityStore.values()) {
                  if (query.$or) {
                    for (const cond of query.$or) {
                      if (cond.primaryOwnerId && e.primaryOwnerId?.toString() === cond.primaryOwnerId.toString()) return Promise.resolve(e);
                      if (cond._id && e._id.toString() === cond._id.toString()) return Promise.resolve(e);
                    }
                  }
                  if (query.primaryOwnerId && e.primaryOwnerId?.toString() === query.primaryOwnerId.toString()) return Promise.resolve(e);
                }
                return Promise.resolve(null);
              },
            }),
            lean: () => {
              for (const e of entityStore.values()) {
                if (query.primaryOwnerId && e.primaryOwnerId?.toString() === query.primaryOwnerId.toString()) return Promise.resolve(e);
              }
              return Promise.resolve(null);
            },
          })),
        },
      },
    };

    const paymentContextMock = {
      getAvailablePaymentMethods: jest.fn().mockReturnValue(['COD', 'STRIPE', 'PAYMOB']),
    };

    const checkoutSagaMock = {
      execute: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        AuthController,
        ProductController,
        {
          provide: ProductService,
          useValue: {
            createProduct: jest.fn().mockResolvedValue({
              _id: 'prod_123',
              title: 'Test Product',
              status: 'DRAFT',
            }),
          },
        },
        OrderController,
        {
          provide: OrderService,
          useValue: {
            getEntityOrders: jest.fn().mockResolvedValue([]),
          },
        },
        SellerPayoutController,
        {
          provide: SellerPayoutService,
          useValue: {
            resolveSellingEntityId: jest.fn().mockImplementation((reqId, ownerId, user) => {
              return reqId || user?.sellingEntityId;
            }),
            requestPayout: jest.fn().mockResolvedValue({
              success: true,
              message: 'Payout requested successfully',
            }),
          },
        },
        MerchantController,
        SellingEntityService,
        SellingEntityFactory,
        AdminSellerService,
        AuthenticationGuard,
        ApprovedEntityGuard,
        PermissionsGuard,
        Reflector,
        {
          provide: JwtService,
          useValue: new JwtService({ secret: JWT_SECRET }),
        },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: CACHE_SERVICE, useValue: cacheServiceMock },
        { provide: CACHE_MANAGER, useValue: cacheServiceMock },
        { provide: MAILER_SERVICE, useValue: mailerServiceMock },
        { provide: UserRepo, useValue: userRepoMock },
        { provide: SellingEntityRepo, useValue: sellingEntityRepoMock },
        { provide: SessionRepo, useValue: sessionRepoMock },
        { provide: PermissionRepo, useValue: permissionRepoMock },
        { provide: BrandRepo, useValue: brandRepoMock },
        { provide: ProductRepo, useValue: productRepoMock },
        { provide: EntityOrderRepo, useValue: entityOrderRepoMock },
        { provide: EscrowRepo, useValue: escrowRepoMock },
        { provide: PayoutRepo, useValue: payoutRepoMock },
        { provide: CustomerRepo, useValue: customerRepoMock },
        { provide: PaymentContext, useValue: paymentContextMock },
        { provide: CheckoutSagaService, useValue: checkoutSagaMock },
        { provide: getConnectionToken(), useValue: connectionMock },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    authController = module.get<AuthController>(AuthController);
    productController = module.get<ProductController>(ProductController);
    productService = module.get<ProductService>(ProductService);
    orderController = module.get<OrderController>(OrderController);
    orderService = module.get<OrderService>(OrderService);
    sellerPayoutController = module.get<SellerPayoutController>(SellerPayoutController);
    sellerPayoutService = module.get<SellerPayoutService>(SellerPayoutService);
    merchantController = module.get<MerchantController>(MerchantController);
    sellingEntityService = module.get<SellingEntityService>(SellingEntityService);
    adminSellerService = module.get<AdminSellerService>(AdminSellerService);

    authGuard = module.get<AuthenticationGuard>(AuthenticationGuard);
    approvedEntityGuard = module.get<ApprovedEntityGuard>(ApprovedEntityGuard);
    permissionsGuard = module.get<PermissionsGuard>(PermissionsGuard);
    jwtService = module.get<JwtService>(JwtService);
    reflector = module.get<Reflector>(Reflector);
  });

  describe('Merchant Entity Lifecycle & Operational Guarding Integration Flow', () => {
    let pendingSellerEmail = 'ahmed.merchant@marketplace.com';
    let pendingSellerPassword = 'Password@123';
    let pendingSellerToken: string;
    let sellingEntityId: string;
    let sellerUserId: string;

    it('1. Register seller & verify OTP -> Confirm status is PENDING_APPROVAL and token is scoped', async () => {
      // Register Seller
      const regResult = await authService.registerSeller({
        userName: 'Ahmed Merchant',
        email: pendingSellerEmail,
        password: pendingSellerPassword,
        phoneNumber: '+201012345678',
        role: RolesEnum.SELLER,
        storeName: 'Ahmed Tech Store',
        description: 'Tech store',
      });

      expect(regResult).toBeDefined();
      expect(regResult.sellingEntity.status).toBe(EntityStatusEnum.PENDING_APPROVAL);
      sellingEntityId = regResult.sellingEntity.id.toString();

      // Retrieve generated OTP from user store
      const user = userStore.get(pendingSellerEmail);
      expect(user).toBeDefined();
      expect(user.isEmailVerified).toBe(false);
      expect(user.sellingEntityId.toString()).toBe(sellingEntityId);

      // Verify OTP
      const updatedUser = userStore.get(pendingSellerEmail);
      updatedUser.isEmailVerified = true;
      userStore.set(pendingSellerEmail, updatedUser);

      // Generate verified token with PENDING_APPROVAL status
      const loginRes = await authService.login({
        email: pendingSellerEmail,
        password: pendingSellerPassword,
      });

      pendingSellerToken = loginRes.data.accessToken;
      sellerUserId = loginRes.data.user.id;

      expect(loginRes.data.user.entityStatus).toBe(EntityStatusEnum.PENDING_APPROVAL);

      // Verify token scoping: NO operational permissions (product.*, order.*, payout.*)
      const decoded: any = jwtService.decode(pendingSellerToken);
      expect(decoded.entityStatus).toBe(EntityStatusEnum.PENDING_APPROVAL);
      expect(decoded.permissions).not.toContain(Permission.PRODUCT_CREATE);
      expect(decoded.permissions).not.toContain(Permission.ORDER_READ_ENTITY);
      expect(decoded.permissions).not.toContain(Permission.PAYOUT_REQUEST);
      expect(decoded.permissions).toContain(Permission.PROFILE_READ_OWN);
    });

    it('2. Attempt POST /products with pending seller token -> Must return 403 Forbidden', async () => {
      await expect(
        runGuardPipeline(
          pendingSellerToken,
          productController.createProduct,
          ProductController,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('3. Attempt GET /orders/merchant with pending seller token -> Must return 403 Forbidden', async () => {
      await expect(
        runGuardPipeline(
          pendingSellerToken,
          orderController.getMerchantOrders,
          OrderController,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('4. Attempt POST /payouts/request with pending seller token -> Must return 403 Forbidden', async () => {
      await expect(
        runGuardPipeline(
          pendingSellerToken,
          sellerPayoutController.requestPayout,
          SellerPayoutController,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('5. Attempt GET /merchant/entity/status with pending seller token -> Must return 200 OK', async () => {
      const { req } = await runGuardPipeline(
        pendingSellerToken,
        merchantController.getEntityStatus,
        MerchantController,
      );

      const statusRes = await merchantController.getEntityStatus(req);
      expect(statusRes).toBeDefined();
      expect(statusRes.success).toBe(true);
      expect(statusRes.data.status).toBe(EntityStatusEnum.PENDING_APPROVAL);
      expect(statusRes.data.entityId.toString()).toBe(sellingEntityId);
    });

    it('6. Admin approves entity -> Verify cache invalidation & tokenVersion update', async () => {
      // Seed cached status
      inMemoryCache.set(`entity:status:${sellingEntityId}`, EntityStatusEnum.PENDING_APPROVAL);
      expect(inMemoryCache.has(`entity:status:${sellingEntityId}`)).toBe(true);

      const oldVersion = inMemoryCache.get(`auth:token_version:${sellerUserId}`) || 1;

      // Admin executes approval
      const approvalRes = await adminSellerService.approveEntity(sellingEntityId);
      expect(approvalRes.success).toBe(true);

      // Verify cache invalidation
      expect(inMemoryCache.has(`entity:status:${sellingEntityId}`)).toBe(false);

      // Verify tokenVersion increment
      const newVersion = inMemoryCache.get(`auth:token_version:${sellerUserId}`);
      expect(newVersion).toBeGreaterThan(oldVersion);

      // Verify DB entity status is APPROVED
      const entity = entityStore.get(sellingEntityId);
      expect(entity.status).toBe(EntityStatusEnum.APPROVED);
    });

    it('7. Login as approved seller -> Attempt POST /products -> Must return 201 Created', async () => {
      // Merchant logs in post-approval
      const loginRes = await authService.login({
        email: pendingSellerEmail,
        password: pendingSellerPassword,
      });

      const approvedToken = loginRes.data.accessToken;
      expect(loginRes.data.user.entityStatus).toBe(EntityStatusEnum.APPROVED);

      // Verify decoded permissions now include full operational permissions
      const decoded: any = jwtService.decode(approvedToken);
      expect(decoded.entityStatus).toBe(EntityStatusEnum.APPROVED);
      expect(decoded.permissions).toContain(Permission.PRODUCT_CREATE);

      // Attempt POST /products through guard pipeline
      const { req } = await runGuardPipeline(
        approvedToken,
        productController.createProduct,
        ProductController,
      );

      const createRes = await productController.createProduct(
        { title: 'New Gaming Laptop', price: 1500 } as any,
        req,
      );
      expect(createRes).toBeDefined();
      expect((createRes as any).title).toBe('Test Product');
    });

    it('8. Admin rejects entity -> Immediate next request with prior token must return 401 or 403 Forbidden', async () => {
      // Obtain an active token for the approved seller
      const loginRes = await authService.login({
        email: pendingSellerEmail,
        password: pendingSellerPassword,
      });
      const activeToken = loginRes.data.accessToken;

      // Admin rejects the entity
      await adminSellerService.rejectEntity(sellingEntityId, 'Regulatory non-compliance');

      // Next request with activeToken must fail with 401 (tokenVersion revoked) or 403 (entity status rejected)
      let rejected = false;
      try {
        await runGuardPipeline(
          activeToken,
          productController.createProduct,
          ProductController,
        );
      } catch (err: any) {
        rejected = true;
        expect(
          err instanceof UnauthorizedException || err instanceof ForbiddenException,
        ).toBe(true);
      }
      expect(rejected).toBe(true);
    });

    it('9. Attempt privilege escalation: Register with { role: "admin" } in body -> Must assign "seller" and ignore payload manipulation', async () => {
      const exploitEmail = 'exploit.admin@marketplace.com';
      const regResult = await authService.registerSeller({
        userName: 'Attacker Trying Admin',
        email: exploitEmail,
        password: 'Password@123',
        phoneNumber: '+201099887766',
        role: 'admin' as any,
        storeName: 'Escalation Attempt Store',
        description: 'Should be seller not admin',
      });

      expect(regResult).toBeDefined();
      const createdUser = userStore.get(exploitEmail);
      expect(createdUser).toBeDefined();
      expect(createdUser.role).toBe(RolesEnum.SELLER);
      expect(createdUser.role).not.toBe(RolesEnum.ADMIN);
      expect(createdUser.role).not.toBe(RolesEnum.SUPER_ADMIN);
    });
  });
});
