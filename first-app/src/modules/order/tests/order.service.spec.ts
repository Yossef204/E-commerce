import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';

import { OrderService } from '../order.service';
import { OrderFactory } from '../factory/order.factory';
import { MainOrderRepo } from '../../../models/order/main-order.repository';
import { EntityOrderRepo } from '../../../models/order/entity-order.repository';
import { InventoryRepo } from '../../../models/inventory/inventory.repository';
import { ProductRepo } from '../../../models/product/product.repository';
import { SellingEntityRepo } from '../../../models/selling-entity/selling-entity.repository';
import { UserRepo } from '../../../models/user/user.repository';
import { EscrowRepo } from '../../../models/escrow/escrow.repository';
import { LedgerRepo } from '../../../models/ledger/ledger.repository';
import { PaymentRepo } from '../../../models/payment/payment.repository';
import { PaymentContext } from '../../../shared/payment/context/payment.context';
import { CouponService } from '../../coupon/coupon.service';
import { NotificationService } from '../../notification/notification.service';
import { MailService } from '../../../shared/mailer/mail.service';

import { MainOrder } from '../../../models/order/main-order.schema';
import { EntityOrder } from '../../../models/order/entity-order.schema';
import { Product } from '../../../models/product/product.schema';
import { MainOrderStatusEnum } from '../../../common/enums/main-order-status.enum';
import { EntityOrderStatusEnum } from '../../../common/enums/entity-order-status.enum';
import { PaymentMethodEnum } from '../../../common/enums/payment-method.enum';
import { ProductApprovalStatusEnum } from '../../../common/enums/product-approval-status.enum';
import { EscrowStatusEnum } from '../../../common/enums/escrow-status.enum';
import { CouponScopeEnum } from '../../../common/enums/coupon-scope.enum';
import { LedgerMovementTypeEnum } from '../../../models/ledger/ledger-entry.schema';

describe('OrderService', () => {
  let service: OrderService;
  let mainOrderRepo: any;
  let entityOrderRepo: any;
  let inventoryRepo: any;
  let productRepo: any;
  let sellingEntityRepo: any;
  let userRepo: any;
  let escrowRepo: any;
  let ledgerRepo: any;
  let paymentRepo: any;
  let paymentContext: any;
  let couponService: any;
  let notificationService: any;
  let mailService: any;
  let cacheManager: any;
  let eventEmitter: any;

  const mockCustomerId = new Types.ObjectId('650000000000000000000010');
  const mockVendorAId = new Types.ObjectId('650000000000000000000020');
  const mockVendorBId = new Types.ObjectId('650000000000000000000030');
  const mockMainOrderId = new Types.ObjectId('650000000000000000000040');
  const mockEntityOrderIdA = new Types.ObjectId('650000000000000000000050');
  const mockEntityOrderIdB = new Types.ObjectId('650000000000000000000060');

  const mockConnection = {
    client: {
      topology: {
        description: {
          type: 'Single',
        },
      },
    },
    startSession: jest.fn(),
  };

  const mockPaymentStrategy = {
    processPayment: jest.fn().mockResolvedValue({
      success: true,
      status: 'CAPTURED',
      transactionId: 'TRX-ONLINE-12345',
    }),
  };

  beforeEach(async () => {
    mainOrderRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({
          _id: mockMainOrderId,
          orderNumber: 'ORD-9999-1111',
          ...data,
        }),
      ),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      getAll: jest.fn().mockResolvedValue([]),
    };

    entityOrderRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({
          _id: new Types.ObjectId(),
          ...data,
        }),
      ),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      getAll: jest.fn().mockResolvedValue([]),
    };

    inventoryRepo = {
      getOne: jest.fn(),
      reserveStockAtomic: jest.fn().mockResolvedValue(true),
      releaseStockAtomic: jest.fn().mockResolvedValue(true),
      commitStockAtomic: jest.fn().mockResolvedValue(true),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    productRepo = {
      getOne: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    sellingEntityRepo = {
      getOne: jest.fn(),
    };

    userRepo = {
      getOne: jest.fn().mockResolvedValue({
        _id: mockCustomerId,
        userName: 'Ahmed Mohamed',
        email: 'customer@example.com',
        phoneNumber: '01012345678',
      }),
    };

    escrowRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({ _id: new Types.ObjectId(), ...data }),
      ),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    ledgerRepo = {
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({ _id: new Types.ObjectId(), ...data }),
      ),
      model: {
        updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      },
    };

    paymentRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((data) =>
        Promise.resolve({ _id: new Types.ObjectId(), ...data }),
      ),
    };

    paymentContext = {
      getStrategy: jest.fn().mockReturnValue(mockPaymentStrategy),
    };

    couponService = {
      validateAndApplyCoupon: jest.fn(),
      recordCouponUsage: jest.fn().mockResolvedValue(true),
    };

    notificationService = {
      sendNotification: jest.fn().mockResolvedValue(true),
    };

    mailService = {
      send: jest.fn().mockResolvedValue(true),
    };

    cacheManager = {
      get: jest.fn(),
      set: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        OrderFactory,
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: CACHE_MANAGER, useValue: cacheManager },
        { provide: MainOrderRepo, useValue: mainOrderRepo },
        { provide: EntityOrderRepo, useValue: entityOrderRepo },
        { provide: InventoryRepo, useValue: inventoryRepo },
        { provide: ProductRepo, useValue: productRepo },
        { provide: SellingEntityRepo, useValue: sellingEntityRepo },
        { provide: UserRepo, useValue: userRepo },
        { provide: EscrowRepo, useValue: escrowRepo },
        { provide: LedgerRepo, useValue: ledgerRepo },
        { provide: PaymentRepo, useValue: paymentRepo },
        { provide: PaymentContext, useValue: paymentContext },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: CouponService, useValue: couponService },
        { provide: NotificationService, useValue: notificationService },
        { provide: MailService, useValue: mailService },
        { provide: getModelToken(MainOrder.name), useValue: {} },
        { provide: getModelToken(EntityOrder.name), useValue: {} },
        { provide: getModelToken(Product.name), useValue: {} },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Checkout Breakdown (Multi-Vendor Split & Totals)', () => {
    it('should split multi-vendor cart into separate EntityOrders correctly', async () => {
      // Mock Product & Inventory for Vendor A
      inventoryRepo.getOne.mockImplementation(({ sku }) => {
        if (sku === 'SKU-A1') {
          return Promise.resolve({
            sku: 'SKU-A1',
            productId: new Types.ObjectId(),
            availableStock: 10,
          });
        }
        if (sku === 'SKU-B1') {
          return Promise.resolve({
            sku: 'SKU-B1',
            productId: new Types.ObjectId(),
            availableStock: 10,
          });
        }
        return Promise.resolve(null);
      });

      productRepo.getOne.mockImplementation(({ _id }) => {
        // Return Vendor A product or Vendor B product
        return Promise.resolve({
          _id,
          title: 'Vendor Product',
          approvalStatus: ProductApprovalStatusEnum.APPROVED,
          sellingEntityId: mockVendorAId,
          variants: [
            { sku: 'SKU-A1', price: 100, isActive: true },
            { sku: 'SKU-B1', price: 300, isActive: true },
          ],
        });
      });

      // Override for Vendor B product
      productRepo.getOne.mockImplementation(({ _id }) => {
        return Promise.resolve({
          _id,
          title: 'Vendor Product',
          approvalStatus: ProductApprovalStatusEnum.APPROVED,
          sellingEntityId: mockVendorAId,
          variants: [{ sku: 'SKU-A1', price: 100, isActive: true }],
        });
      });

      // Let's configure productRepo getOne for specific product IDs
      const productA = {
        _id: new Types.ObjectId(),
        title: 'Product A from Vendor A',
        approvalStatus: ProductApprovalStatusEnum.APPROVED,
        sellingEntityId: mockVendorAId,
        variants: [{ sku: 'SKU-A1', price: 100, isActive: true }],
      };
      const productB = {
        _id: new Types.ObjectId(),
        title: 'Product B from Vendor B',
        approvalStatus: ProductApprovalStatusEnum.APPROVED,
        sellingEntityId: mockVendorBId,
        variants: [{ sku: 'SKU-B1', price: 300, isActive: true }],
      };

      inventoryRepo.getOne.mockImplementation(({ sku }) => {
        if (sku === 'SKU-A1') {
          return Promise.resolve({ sku: 'SKU-A1', productId: productA._id, availableStock: 10 });
        }
        if (sku === 'SKU-B1') {
          return Promise.resolve({ sku: 'SKU-B1', productId: productB._id, availableStock: 10 });
        }
        return Promise.resolve(null);
      });

      productRepo.getOne.mockImplementation(({ _id }) => {
        if (_id.equals(productA._id)) return Promise.resolve(productA);
        if (_id.equals(productB._id)) return Promise.resolve(productB);
        return Promise.resolve(null);
      });

      sellingEntityRepo.getOne.mockResolvedValue({
        commissionPercentage: 10,
        commissionFixedFee: 0,
      });

      const checkoutDto = {
        items: [
          { sku: 'SKU-A1', quantity: 2 }, // Total: 200
          { sku: 'SKU-B1', quantity: 1 }, // Total: 300
        ],
        shippingAddress: '123 Test Street, Cairo',
        paymentMethod: 'CARD',
        idempotencyKey: 'IDEMP-MULTI-VENDOR-1',
      };

      const result = await service.checkout(mockCustomerId.toString(), checkoutDto as any);

      expect(result.success).toBe(true);
      expect(result.entityOrders).toHaveLength(2);

      const entityOrderA = result.entityOrders.find((eo: any) =>
        eo.sellingEntityId.equals(mockVendorAId),
      );
      const entityOrderB = result.entityOrders.find((eo: any) =>
        eo.sellingEntityId.equals(mockVendorBId),
      );

      expect(entityOrderA).toBeDefined();
      expect(entityOrderA.subtotal).toBe(200);
      expect(entityOrderB).toBeDefined();
      expect(entityOrderB.subtotal).toBe(300);

      expect(result.mainOrder.totalAmount).toBe(500);
      expect(mainOrderRepo.create).toHaveBeenCalled();
      expect(entityOrderRepo.create).toHaveBeenCalledTimes(2);
    });

    it('should throw BadRequestException if product stock is insufficient', async () => {
      const product = {
        _id: new Types.ObjectId(),
        title: 'Scarce Product',
        approvalStatus: ProductApprovalStatusEnum.APPROVED,
        sellingEntityId: mockVendorAId,
        variants: [{ sku: 'SKU-OUT-OF-STOCK', price: 100, isActive: true }],
      };

      inventoryRepo.getOne.mockResolvedValue({
        sku: 'SKU-OUT-OF-STOCK',
        productId: product._id,
        availableStock: 0,
      });
      productRepo.getOne.mockResolvedValue(product);

      // Stock reservation fails
      inventoryRepo.reserveStockAtomic.mockResolvedValue(false);

      const checkoutDto = {
        items: [{ sku: 'SKU-OUT-OF-STOCK', quantity: 5 }],
        shippingAddress: '123 Cairo',
        paymentMethod: 'CARD',
        idempotencyKey: 'IDEMP-FAIL-STOCK',
      };

      await expect(
        service.checkout(mockCustomerId.toString(), checkoutDto as any),
      ).rejects.toThrow(BadRequestException);

      expect(inventoryRepo.releaseStockAtomic).toBeDefined();
    });

    it('should calculate total amounts, shipping, and discounts accurately', async () => {
      const product = {
        _id: new Types.ObjectId(),
        title: 'Discounted Product',
        approvalStatus: ProductApprovalStatusEnum.APPROVED,
        sellingEntityId: mockVendorAId,
        variants: [{ sku: 'SKU-DISC', price: 500, isActive: true }],
      };

      inventoryRepo.getOne.mockResolvedValue({
        sku: 'SKU-DISC',
        productId: product._id,
        availableStock: 20,
      });
      productRepo.getOne.mockResolvedValue(product);
      sellingEntityRepo.getOne.mockResolvedValue({ commissionPercentage: 10 });

      // Apply coupon with 150 EGP discount
      couponService.validateAndApplyCoupon.mockResolvedValue({
        discountAmount: 150,
        coupon: { _id: new Types.ObjectId(), code: 'SAVE150' },
        scope: CouponScopeEnum.PLATFORM,
        sellingEntityId: null,
      });

      const checkoutDto = {
        items: [{ sku: 'SKU-DISC', quantity: 2 }], // 1000 EGP gross
        couponCode: 'SAVE150',
        shippingAddress: '456 Giza, Egypt',
        paymentMethod: 'CARD',
        idempotencyKey: 'IDEMP-DISC-1',
      };

      const result = await service.checkout(mockCustomerId.toString(), checkoutDto as any);

      expect(result.success).toBe(true);
      // Original 1000 - 150 discount = 850
      expect(result.mainOrder.totalAmount).toBe(850);
      expect(result.mainOrder.discountAmount).toBe(150);
      expect(mockPaymentStrategy.processPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 850,
        }),
      );
      expect(couponService.recordCouponUsage).toHaveBeenCalledWith(
        expect.anything(),
        mockCustomerId,
        result.mainOrder._id,
        150,
      );
    });
  });

  describe('COD Flow & OTP Verification', () => {
    it('should set order status to PENDING_COD_VERIFICATION for COD orders and store OTP in Redis', async () => {
      const product = {
        _id: new Types.ObjectId(),
        title: 'COD Product',
        approvalStatus: ProductApprovalStatusEnum.APPROVED,
        sellingEntityId: mockVendorAId,
        variants: [{ sku: 'SKU-COD', price: 250, isActive: true }],
      };

      inventoryRepo.getOne.mockResolvedValue({
        sku: 'SKU-COD',
        productId: product._id,
        availableStock: 10,
      });
      productRepo.getOne.mockResolvedValue(product);
      sellingEntityRepo.getOne.mockResolvedValue({ commissionPercentage: 10 });

      mockPaymentStrategy.processPayment.mockResolvedValueOnce({
        success: true,
        status: 'PENDING',
        transactionId: 'TRX-COD-001',
      });

      const checkoutDto = {
        items: [{ sku: 'SKU-COD', quantity: 1 }],
        shippingAddress: 'Nasr City, Cairo (هاتف: 01012345678)',
        paymentMethod: 'COD',
        idempotencyKey: 'IDEMP-COD-1',
      };

      const result = await service.checkout(mockCustomerId.toString(), checkoutDto as any);

      expect(result.success).toBe(true);
      expect(result.requiresCodVerification).toBe(true);
      expect(result.mainOrder.status).toBe(MainOrderStatusEnum.PENDING_COD_VERIFICATION);
      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringMatching(/^cod_otp:orderId:/),
        expect.stringContaining('"attempts":0'),
        300000,
      );
    });

    it('should throw BadRequestException on invalid COD OTP', async () => {
      mainOrderRepo.getOne.mockResolvedValue({
        _id: mockMainOrderId,
        customerId: mockCustomerId,
        status: MainOrderStatusEnum.PENDING_COD_VERIFICATION,
        orderNumber: 'ORD-9999-1111',
      });

      // OTP in Redis is 123456
      cacheManager.get.mockResolvedValue(
        JSON.stringify({
          otp: '123456',
          attempts: 0,
          customerId: mockCustomerId.toString(),
          orderId: mockMainOrderId.toString(),
        }),
      );

      // Customer submits 000000
      await expect(
        service.verifyCodOtp(mockCustomerId.toString(), mockMainOrderId.toString(), '000000'),
      ).rejects.toThrow(BadRequestException);

      expect(cacheManager.set).toHaveBeenCalledWith(
        expect.stringMatching(/^cod_otp:orderId:/),
        expect.stringContaining('"attempts":1'),
        300000,
      );
    });

    it('should enforce rate limiting on COD OTP verification after 5 failed attempts', async () => {
      mainOrderRepo.getOne.mockResolvedValue({
        _id: mockMainOrderId,
        customerId: mockCustomerId,
        status: MainOrderStatusEnum.PENDING_COD_VERIFICATION,
        orderNumber: 'ORD-9999-1111',
      });

      entityOrderRepo.getAll.mockResolvedValue([
        {
          _id: mockEntityOrderIdA,
          items: [{ sku: 'SKU-COD', quantity: 1 }],
        },
      ]);

      // Cache indicates 4 attempts already made
      cacheManager.get.mockResolvedValue(
        JSON.stringify({
          otp: '123456',
          attempts: 4,
          customerId: mockCustomerId.toString(),
          orderId: mockMainOrderId.toString(),
        }),
      );

      // 5th wrong attempt
      await expect(
        service.verifyCodOtp(mockCustomerId.toString(), mockMainOrderId.toString(), '999999'),
      ).rejects.toThrow(BadRequestException);

      // Keys should be deleted and order cancelled
      expect(cacheManager.del).toHaveBeenCalledWith(
        `cod_otp:orderId:${mockMainOrderId.toString()}`,
      );
      expect(mainOrderRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockMainOrderId },
        { status: MainOrderStatusEnum.CANCELLED },
      );
      expect(entityOrderRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockEntityOrderIdA },
        expect.objectContaining({ status: EntityOrderStatusEnum.CANCELLED }),
      );
      expect(inventoryRepo.releaseStockAtomic).toHaveBeenCalledWith('SKU-COD', 1);
    });

    it('should transition order to CONFIRMED and clear OTP from Redis upon successful verification', async () => {
      mainOrderRepo.getOne.mockResolvedValue({
        _id: mockMainOrderId,
        customerId: mockCustomerId,
        status: MainOrderStatusEnum.PENDING_COD_VERIFICATION,
        orderNumber: 'ORD-9999-1111',
        totalAmount: 500,
      });

      entityOrderRepo.getAll.mockResolvedValue([
        {
          _id: mockEntityOrderIdA,
          sellingEntityId: mockVendorAId,
        },
      ]);

      cacheManager.get.mockResolvedValue(
        JSON.stringify({
          otp: '654321',
          attempts: 1,
          customerId: mockCustomerId.toString(),
          orderId: mockMainOrderId.toString(),
        }),
      );

      const result = await service.verifyCodOtp(
        mockCustomerId.toString(),
        mockMainOrderId.toString(),
        '654321',
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(MainOrderStatusEnum.CONFIRMED);
      expect(cacheManager.del).toHaveBeenCalledWith(
        `cod_otp:orderId:${mockMainOrderId.toString()}`,
      );
      expect(mainOrderRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockMainOrderId },
        { status: MainOrderStatusEnum.CONFIRMED },
      );
      expect(entityOrderRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockEntityOrderIdA },
        expect.objectContaining({ status: EntityOrderStatusEnum.CONFIRMED }),
      );
      expect(eventEmitter.emit).toHaveBeenCalledWith('order.placed', expect.anything());
      expect(eventEmitter.emit).toHaveBeenCalledWith('order.created', expect.anything());
    });
  });

  describe('Resource Scoping & Access Control', () => {
    it('should allow seller to retrieve only their own EntityOrders', async () => {
      const mockSellerOwnerId = '650000000000000000000999';
      const currentUser = {
        id: mockSellerOwnerId,
        role: 'SELLER',
        sellingEntityId: mockVendorAId.toString(),
      };

      sellingEntityRepo.getOne.mockResolvedValue({
        _id: mockVendorAId,
        primaryOwnerId: new Types.ObjectId(mockSellerOwnerId),
      });

      const mockOrders = [
        { _id: mockEntityOrderIdA, sellingEntityId: mockVendorAId, subtotal: 200 },
      ];
      entityOrderRepo.getAll.mockResolvedValue(mockOrders);

      const result = await service.getEntityOrders(
        mockSellerOwnerId,
        mockVendorAId.toString(),
        currentUser,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockOrders);
      expect(entityOrderRepo.getAll).toHaveBeenCalledWith({
        sellingEntityId: mockVendorAId,
      });
    });

    it('should throw ForbiddenException if seller attempts to access another vendor order', async () => {
      const mockSellerOwnerId = '650000000000000000000999';
      const foreignOwnerId = '650000000000000000000888';

      const currentUser = {
        id: mockSellerOwnerId,
        role: 'SELLER',
        sellingEntityId: mockVendorAId.toString(),
      };

      // Vendor B belongs to someone else
      sellingEntityRepo.getOne.mockResolvedValue({
        _id: mockVendorBId,
        primaryOwnerId: new Types.ObjectId(foreignOwnerId),
      });

      await expect(
        service.getEntityOrders(
          mockSellerOwnerId,
          mockVendorBId.toString(),
          currentUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if seller attempts to update another vendor order status', async () => {
      const mockSellerOwnerId = '650000000000000000000999';
      const foreignOwnerId = '650000000000000000000888';

      const currentUser = {
        id: mockSellerOwnerId,
        role: 'SELLER',
        sellingEntityId: mockVendorAId.toString(),
      };

      entityOrderRepo.getOne.mockResolvedValue({
        _id: mockEntityOrderIdB,
        sellingEntityId: mockVendorBId,
      });

      sellingEntityRepo.getOne.mockResolvedValue({
        _id: mockVendorBId,
        primaryOwnerId: new Types.ObjectId(foreignOwnerId),
      });

      await expect(
        service.updateEntityOrderStatus(
          mockSellerOwnerId,
          mockEntityOrderIdB.toString(),
          { status: EntityOrderStatusEnum.PROCESSING },
          currentUser,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('Order Status Progression & Fulfillment Flow', () => {
    it('should update entity order status progressively (CONFIRMED -> PROCESSING -> SHIPPED -> DELIVERED)', async () => {
      const mockSellerOwnerId = '650000000000000000000999';
      const currentUser = {
        id: mockSellerOwnerId,
        role: 'SELLER',
        sellingEntityId: mockVendorAId.toString(),
      };

      const entityOrder = {
        _id: mockEntityOrderIdA,
        mainOrderId: mockMainOrderId,
        sellingEntityId: mockVendorAId,
        status: EntityOrderStatusEnum.CONFIRMED,
        statusHistory: [
          { status: EntityOrderStatusEnum.CONFIRMED, updatedAt: new Date(), note: 'Confirmed' },
        ],
      };

      entityOrderRepo.getOne.mockResolvedValue(entityOrder);
      sellingEntityRepo.getOne.mockResolvedValue({
        _id: mockVendorAId,
        primaryOwnerId: new Types.ObjectId(mockSellerOwnerId),
      });

      // 1. Update to PROCESSING
      await service.updateEntityOrderStatus(
        mockSellerOwnerId,
        mockEntityOrderIdA.toString(),
        { status: EntityOrderStatusEnum.PROCESSING, note: 'Processing package' },
        currentUser,
      );
      expect(entityOrderRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockEntityOrderIdA },
        expect.objectContaining({
          status: EntityOrderStatusEnum.PROCESSING,
        }),
      );

      // 2. Update to SHIPPED
      await service.updateEntityOrderStatus(
        mockSellerOwnerId,
        mockEntityOrderIdA.toString(),
        { status: EntityOrderStatusEnum.SHIPPED, note: 'Dispatched to carrier' },
        currentUser,
      );
      expect(entityOrderRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockEntityOrderIdA },
        expect.objectContaining({
          status: EntityOrderStatusEnum.SHIPPED,
        }),
      );

      // 3. Update to DELIVERED (Simulating COD delivery)
      escrowRepo.getOne.mockResolvedValue({
        _id: new Types.ObjectId(),
        entityOrderId: mockEntityOrderIdA,
        status: EscrowStatusEnum.HELD,
      });
      paymentRepo.getOne.mockResolvedValue({
        paymentMethod: PaymentMethodEnum.COD,
      });

      await service.updateEntityOrderStatus(
        mockSellerOwnerId,
        mockEntityOrderIdA.toString(),
        { status: EntityOrderStatusEnum.DELIVERED, note: 'Delivered to customer' },
        currentUser,
      );

      expect(entityOrderRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockEntityOrderIdA },
        expect.objectContaining({
          status: EntityOrderStatusEnum.DELIVERED,
        }),
      );
      expect(escrowRepo.updateOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          status: EscrowStatusEnum.RELEASED,
        }),
      );
      expect(ledgerRepo.model.updateMany).toHaveBeenCalledWith(
        {
          entityOrderId: mockEntityOrderIdA,
          entryType: LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT,
        },
        expect.anything(),
      );
    });
  });
});

