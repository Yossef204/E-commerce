import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ExecutionContext,
} from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';

// Services under test
import { OrderService } from '../order.service';
import { OrderController } from '../order.controller';
import { OrderFactory } from '../factory/order.factory';
import { ReturnService } from '../../return/return.service';
import { UserService } from '../../user/user.service';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';

// Repositories
import { MainOrderRepo } from '../../../models/order/main-order.repository';
import { EntityOrderRepo } from '../../../models/order/entity-order.repository';
import { InventoryRepo } from '../../../models/inventory/inventory.repository';
import { ProductRepo } from '../../../models/product/product.repository';
import { SellingEntityRepo } from '../../../models/selling-entity/selling-entity.repository';
import { UserRepo } from '../../../models/user/user.repository';
import { EscrowRepo } from '../../../models/escrow/escrow.repository';
import { LedgerRepo } from '../../../models/ledger/ledger.repository';
import { PaymentRepo } from '../../../models/payment/payment.repository';
import { ReturnRequestRepo } from '../../../models/return/return-request.repository';
import { PaymentContext } from '../../../shared/payment/context/payment.context';
import { CheckoutSagaService } from '../../../shared/payment/saga/checkout.saga';
import { CouponService } from '../../coupon/coupon.service';
import { NotificationService } from '../../notification/notification.service';
import { MailService } from '../../../shared/mailer/mail.service';
import { FileUploadsService } from '../../../shared/file-uploads/file-uploads.service';

// Schemas & Enums
import { MainOrder } from '../../../models/order/main-order.schema';
import { EntityOrder } from '../../../models/order/entity-order.schema';
import { Product } from '../../../models/product/product.schema';
import { MainOrderStatusEnum } from '../../../common/enums/main-order-status.enum';
import { EntityOrderStatusEnum } from '../../../common/enums/entity-order-status.enum';
import { RolesEnum } from '../../../common/enums/roles';
import { Permission } from '../../../common/enums/permission.enum';
import {
  DEFAULT_CUSTOMER_PERMISSIONS,
  DEFAULT_SELLER_PERMISSIONS,
} from '../../../common/enums/permissions.enum';

describe('Security & IDOR Prevention Integration Spec', () => {
  // Test Identities
  const mockUserAId = new Types.ObjectId('650000000000000000000001');
  const mockUserBId = new Types.ObjectId('650000000000000000000002');
  const mockVendorEntityId = new Types.ObjectId('650000000000000000000003');
  const mockSellerUserId = new Types.ObjectId('650000000000000000000004');

  // Test Resources
  const mockOrder1Id = new Types.ObjectId('650000000000000000000011');
  const mockOrder2Id = new Types.ObjectId('650000000000000000000022');
  const mockReturn1Id = new Types.ObjectId('650000000000000000000031');
  const mockReturn2Id = new Types.ObjectId('650000000000000000000032');

  // Customer A Context
  const userAContext = {
    id: mockUserAId.toString(),
    sub: mockUserAId.toString(),
    role: RolesEnum.CUSTOMER,
    permissions: [...DEFAULT_CUSTOMER_PERMISSIONS],
  };

  // Seller Context
  const sellerContext = {
    id: mockSellerUserId.toString(),
    sub: mockSellerUserId.toString(),
    sellingEntityId: mockVendorEntityId.toString(),
    role: RolesEnum.SELLER,
    permissions: [...DEFAULT_SELLER_PERMISSIONS],
  };

  // Services
  let orderService: OrderService;
  let orderController: OrderController;
  let returnService: ReturnService;
  let userService: UserService;
  let permissionsGuard: PermissionsGuard;

  // Mock Repositories
  let mainOrderRepo: any;
  let entityOrderRepo: any;
  let inventoryRepo: any;
  let returnRepo: any;
  let userRepo: any;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(async () => {
    // Database storage state for mock records
    const inMemoryOrders: Record<string, any> = {
      [mockOrder1Id.toString()]: {
        _id: mockOrder1Id,
        orderNumber: 'ORD-AAA-111',
        customerId: mockUserAId,
        status: MainOrderStatusEnum.PENDING_PAYMENT,
        totalAmount: 150,
      },
      [mockOrder2Id.toString()]: {
        _id: mockOrder2Id,
        orderNumber: 'ORD-BBB-222',
        customerId: mockUserBId,
        status: MainOrderStatusEnum.PENDING_PAYMENT,
        totalAmount: 300,
      },
    };

    const inMemoryReturns: Record<string, any> = {
      [mockReturn1Id.toString()]: {
        _id: mockReturn1Id,
        customerId: mockUserAId,
        sellingEntityId: mockVendorEntityId,
        status: 'PENDING_APPROVAL',
      },
      [mockReturn2Id.toString()]: {
        _id: mockReturn2Id,
        customerId: mockUserBId,
        sellingEntityId: mockVendorEntityId,
        status: 'PENDING_APPROVAL',
      },
    };

    const inMemoryUsers: Record<string, any> = {
      [mockUserAId.toString()]: {
        _id: mockUserAId,
        userName: 'Alice',
        email: 'alice@example.com',
        role: RolesEnum.CUSTOMER,
      },
      [mockUserBId.toString()]: {
        _id: mockUserBId,
        userName: 'Bob',
        email: 'bob@example.com',
        role: RolesEnum.CUSTOMER,
      },
    };

    mainOrderRepo = {
      getOne: jest.fn().mockImplementation((query: any) => {
        const idStr = query._id?.toString();
        const order = inMemoryOrders[idStr];
        if (!order) return Promise.resolve(null);
        if (query.customerId && order.customerId.toString() !== query.customerId.toString()) {
          return Promise.resolve(null);
        }
        return Promise.resolve({ ...order });
      }),
      getAll: jest.fn().mockImplementation((query: any) => {
        const orders = Object.values(inMemoryOrders).filter((o: any) => {
          if (query.customerId && o.customerId.toString() !== query.customerId.toString()) {
            return false;
          }
          return true;
        });
        return Promise.resolve(orders);
      }),
      updateOne: jest.fn().mockImplementation((filter: any, update: any) => {
        const idStr = filter._id?.toString();
        if (inMemoryOrders[idStr]) {
          if (update.status) inMemoryOrders[idStr].status = update.status;
          return Promise.resolve({ modifiedCount: 1 });
        }
        return Promise.resolve({ modifiedCount: 0 });
      }),
    };

    entityOrderRepo = {
      getAll: jest.fn().mockResolvedValue([]),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    inventoryRepo = {
      releaseStockAtomic: jest.fn().mockResolvedValue(true),
    };

    returnRepo = {
      getOne: jest.fn().mockImplementation((query: any) => {
        const idStr = query._id?.toString();
        const ret = inMemoryReturns[idStr];
        return Promise.resolve(ret ? { ...ret } : null);
      }),
      model: {
        find: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            populate: jest.fn().mockReturnValue({
              populate: jest.fn().mockReturnValue({
                lean: jest.fn().mockReturnValue({
                  exec: jest.fn().mockResolvedValue([]),
                }),
              }),
            }),
          }),
        }),
      },
    };

    userRepo = {
      getOne: jest.fn().mockImplementation((query: any) => {
        const idStr = query._id?.toString();
        const user = inMemoryUsers[idStr];
        return Promise.resolve(user ? { ...user } : null);
      }),
      updateOne: jest.fn().mockImplementation((filter: any, update: any) => {
        const idStr = filter._id?.toString();
        if (inMemoryUsers[idStr] && update.$set) {
          Object.assign(inMemoryUsers[idStr], update.$set);
          return Promise.resolve({ ...inMemoryUsers[idStr] });
        }
        return Promise.resolve(null);
      }),
    };

    reflector = { getAllAndOverride: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        OrderFactory,
        ReturnService,
        UserService,
        { provide: getConnectionToken(), useValue: { startSession: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() } },
        { provide: MainOrderRepo, useValue: mainOrderRepo },
        { provide: EntityOrderRepo, useValue: entityOrderRepo },
        { provide: InventoryRepo, useValue: inventoryRepo },
        { provide: ProductRepo, useValue: { getOne: jest.fn() } },
        { provide: SellingEntityRepo, useValue: { getOne: jest.fn() } },
        { provide: UserRepo, useValue: userRepo },
        { provide: EscrowRepo, useValue: { getOne: jest.fn() } },
        { provide: LedgerRepo, useValue: { create: jest.fn() } },
        { provide: PaymentRepo, useValue: { getOne: jest.fn() } },
        { provide: ReturnRequestRepo, useValue: returnRepo },
        { provide: PaymentContext, useValue: { getAvailablePaymentMethods: jest.fn() } },
        { provide: CheckoutSagaService, useValue: {} },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
        { provide: CouponService, useValue: {} },
        { provide: NotificationService, useValue: { sendNotification: jest.fn() } },
        { provide: MailService, useValue: { send: jest.fn() } },
        { provide: FileUploadsService, useValue: {} },
        { provide: JwtService, useValue: { verifyAsync: jest.fn() } },
        { provide: Reflector, useValue: reflector },
        { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('test_secret') } },
        { provide: getModelToken(MainOrder.name), useValue: {} },
        { provide: getModelToken(EntityOrder.name), useValue: {} },
        { provide: getModelToken(Product.name), useValue: {} },
        {
          provide: PermissionsGuard,
          useFactory: () =>
            new PermissionsGuard(
              reflector as unknown as Reflector,
              { verifyAsync: jest.fn() } as unknown as JwtService,
              { get: jest.fn().mockReturnValue('test_secret') } as unknown as ConfigService,
            ),
        },
      ],
      controllers: [OrderController],
    }).compile();

    orderService = module.get<OrderService>(OrderService);
    orderController = module.get<OrderController>(OrderController);
    returnService = module.get<ReturnService>(ReturnService);
    userService = module.get<UserService>(UserService);
    permissionsGuard = module.get<PermissionsGuard>(PermissionsGuard);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Test 1: Customer A attempts to read Customer B's order
  // =========================================================================
  describe('Test 1: Cross-Tenant Order Read Isolation (IDOR Prevention)', () => {
    it('should throw 404 NotFoundException when Customer A attempts to read Customer B order by ID', async () => {
      // User A attempts to read Order 2 (owned by User B)
      await expect(
        orderService.getOrderById(
          mockOrder2Id.toString(),
          mockUserAId.toString(),
          userAContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return empty list (or User A orders only) when Customer A passes Customer B ID in query params', async () => {
      // User A attempts to query User B's orders collection via query params
      const result = await orderService.getMyOrders(
        mockUserAId.toString(),
        mockUserBId.toString(), // Attacker tries to inject User B's ID
        userAContext,
      );

      // System ignores queryCustomerId and strictly queries for mockUserAId
      expect(result.orders).toBeDefined();
      expect(result.orders.length).toBe(1);
      expect(result.orders[0]._id.toString()).toBe(mockOrder1Id.toString());
      expect(result.orders[0].customerId.toString()).toBe(mockUserAId.toString());
    });

    it('should allow SuperAdmin to oversight and query Customer B order', async () => {
      const adminContext = {
        id: new Types.ObjectId().toString(),
        role: RolesEnum.SUPER_ADMIN,
        permissions: [Permission.ORDER_READ_ALL],
      };

      const result = await orderService.getOrderById(
        mockOrder2Id.toString(),
        adminContext.id,
        adminContext,
      );
      expect(result.success).toBe(true);
      expect(result.data._id.toString()).toBe(mockOrder2Id.toString());
    });
  });

  // =========================================================================
  // Test 2: Customer A attempts to cancel Customer B's order
  // =========================================================================
  describe('Test 2: Cross-Tenant Order Cancellation Protection (IDOR Prevention)', () => {
    it('should throw 404 NotFoundException and preserve Order 2 status when Customer A attempts to cancel Order 2', async () => {
      // Setup: Order 2 owned by User B with status PENDING_PAYMENT
      await expect(
        orderService.cancelMyOrder(
          mockOrder2Id.toString(),
          mockUserAId.toString(),
          userAContext,
        ),
      ).rejects.toThrow(NotFoundException);

      // Verify: Order 2 update was not performed
      expect(mainOrderRepo.updateOne).not.toHaveBeenCalledWith(
        expect.objectContaining({ _id: mockOrder2Id }),
        expect.anything(),
      );
    });

    it('should allow Customer A to cancel their own PENDING order and update status to CANCELLED', async () => {
      const result = await orderService.cancelMyOrder(
        mockOrder1Id.toString(),
        mockUserAId.toString(),
        userAContext,
      );

      expect(result.success).toBe(true);
      expect(inventoryRepo.releaseStockAtomic).toBeDefined();
      expect(mainOrderRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockOrder1Id },
        { status: MainOrderStatusEnum.CANCELLED },
      );
    });

    it('should reject cancelling an order that is already COMPLETED with BadRequestException', async () => {
      // Mock Order 1 as COMPLETED
      mainOrderRepo.getOne.mockResolvedValueOnce({
        _id: mockOrder1Id,
        customerId: mockUserAId,
        status: MainOrderStatusEnum.COMPLETED,
      });

      await expect(
        orderService.cancelMyOrder(
          mockOrder1Id.toString(),
          mockUserAId.toString(),
          userAContext,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // Test 3: Customer A attempts to view Customer B's return request
  // =========================================================================
  describe('Test 3: Cross-Tenant Return Request Read Isolation (IDOR Prevention)', () => {
    it('should throw 404 NotFoundException when Customer A queries Return 2 owned by Customer B', async () => {
      // Return 2 belongs to User B
      await expect(
        returnService.getReturnById(
          mockReturn2Id.toString(),
          mockUserAId.toString(),
          userAContext,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow Customer B to view their own return request', async () => {
      const userBContext = {
        id: mockUserBId.toString(),
        role: RolesEnum.CUSTOMER,
        permissions: [...DEFAULT_CUSTOMER_PERMISSIONS],
      };

      const result = await returnService.getReturnById(
        mockReturn2Id.toString(),
        mockUserBId.toString(),
        userBContext,
      );
      expect(result).toBeDefined();
      expect(result._id.toString()).toBe(mockReturn2Id.toString());
      expect(result.customerId.toString()).toBe(mockUserBId.toString());
    });

    it('should allow the Vendor owning the sellingEntity to view the return request', async () => {
      const result = await returnService.getReturnById(
        mockReturn2Id.toString(),
        sellerContext.id,
        sellerContext,
      );
      expect(result).toBeDefined();
      expect(result.sellingEntityId.toString()).toBe(mockVendorEntityId.toString());
    });
  });

  // =========================================================================
  // Test 4: Customer A attempts to update Customer B's profile
  // =========================================================================
  describe('Test 4: User Profile Modification Isolation (IDOR Prevention)', () => {
    it('should throw 403 ForbiddenException and preserve Customer B data when Customer A targets Customer B ID', async () => {
      // User A attempts to update profile targeting User B's ID in payload
      const maliciousPayload = {
        userId: mockUserBId.toString(),
        userName: 'Malicious Name Modification',
      };

      await expect(
        userService.updateProfile(
          mockUserAId.toString(),
          maliciousPayload,
          userAContext,
        ),
      ).rejects.toThrow(ForbiddenException);

      // Verify: User B was never modified
      expect(userRepo.updateOne).not.toHaveBeenCalledWith(
        { _id: mockUserBId },
        expect.anything(),
        expect.anything(),
      );
    });

    it('should allow Customer A to update their own profile and strictly target their own _id', async () => {
      const validPayload = {
        userName: 'Alice Genuine Update',
        phoneNumber: '01012345678',
      };

      const result = await userService.updateProfile(
        mockUserAId.toString(),
        validPayload,
        userAContext,
      );

      expect(result.success).toBe(true);
      expect(userRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockUserAId },
        { $set: expect.objectContaining({ userName: 'Alice Genuine Update' }) },
        { new: true },
      );
    });
  });

  // =========================================================================
  // Test 5: Verify Seller cannot execute admin actions
  // =========================================================================
  describe('Test 5: Seller Admin Action Restriction (RBAC Hardening)', () => {
    const createMockExecutionContext = (user: any): ExecutionContext => {
      return {
        switchToHttp: () => ({
          getRequest: () => ({
            user,
            headers: { authorization: 'Bearer mock_seller_token' },
          }),
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;
    };

    it('should explicitly confirm absence of admin permissions in DEFAULT_SELLER_PERMISSIONS', () => {
      expect(DEFAULT_SELLER_PERMISSIONS).not.toContain(Permission.ORDER_READ_ALL);
      expect(DEFAULT_SELLER_PERMISSIONS).not.toContain(Permission.PRODUCT_APPROVE);
      expect(DEFAULT_SELLER_PERMISSIONS).not.toContain(Permission.REFUND_EXECUTE);
      expect(DEFAULT_SELLER_PERMISSIONS).not.toContain(Permission.PAYOUT_PROCESS);
      expect(DEFAULT_SELLER_PERMISSIONS).not.toContain('order.read_all');
      expect(DEFAULT_SELLER_PERMISSIONS).not.toContain('product.approve');
      expect(DEFAULT_SELLER_PERMISSIONS).not.toContain('refund.execute');
      expect(DEFAULT_SELLER_PERMISSIONS).not.toContain('payout.process');
    });

    it('should reject Seller attempting to call POST /payments/payout/execute with 403 Forbidden', async () => {
      // Route protected with @permissions(Permission.PAYOUT_PROCESS)
      reflector.getAllAndOverride.mockReturnValue([Permission.PAYOUT_PROCESS]);

      const context = createMockExecutionContext(sellerContext);

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should reject Seller attempting to call PATCH /products/:id/approve with 403 Forbidden', async () => {
      // Route protected with @permissions(Permission.PRODUCT_APPROVE)
      reflector.getAllAndOverride.mockReturnValue([Permission.PRODUCT_APPROVE]);

      const context = createMockExecutionContext(sellerContext);

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
