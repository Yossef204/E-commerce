import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';

import { ReturnService } from '../return.service';
import { ReturnRequestRepo } from '../../../models/return/return-request.repository';
import { MainOrderRepo } from '../../../models/order/main-order.repository';
import { EntityOrderRepo } from '../../../models/order/entity-order.repository';
import { SellingEntityRepo } from '../../../models/selling-entity/selling-entity.repository';
import { InventoryRepo } from '../../../models/inventory/inventory.repository';
import { LedgerRepo } from '../../../models/ledger/ledger.repository';
import { PaymentRepo } from '../../../models/payment/payment.repository';
import { ProductRepo } from '../../../models/product/product.repository';
import { PaymentService } from '../../payment/payment.service';

import { ReturnRequest } from '../../../models/return/return-request.schema';
import { MainOrder } from '../../../models/order/main-order.schema';
import { EntityOrder } from '../../../models/order/entity-order.schema';
import { SellingEntity } from '../../../models/selling-entity/selling-entity.schema';
import { Inventory } from '../../../models/inventory/inventory.schema';
import { LedgerEntry } from '../../../models/ledger/ledger-entry.schema';
import { Product } from '../../../models/product/product.schema';

import {
  ReturnStatusEnum,
  InspectionResultEnum,
  RefundMethodEnum,
} from '../../../common/enums/return-status.enum';
import { EntityOrderStatusEnum } from '../../../common/enums/entity-order-status.enum';
import { RolesEnum } from '../../../common/enums/roles';
import {
  LedgerMovementTypeEnum,
  LedgerEntryStatusEnum,
} from '../../../models/ledger/ledger-entry.schema';
import { LedgerAccountEnum } from '../../../common/enums/ledger-account.enum';
import { LedgerEntryTypeEnum } from '../../../common/enums/ledger-entry-type.enum';
import { CreateReturnRequestDto } from '../dto/create-return-request.dto';
import { InspectReturnRequestDto } from '../dto/inspect-return-request.dto';

describe('ReturnService', () => {
  let service: ReturnService;
  let connection: any;
  let returnRepo: any;
  let mainOrderRepo: any;
  let entityOrderRepo: any;
  let sellingEntityRepo: any;
  let inventoryRepo: any;
  let ledgerRepo: any;
  let paymentRepo: any;
  let productRepo: any;
  let paymentService: any;
  let eventEmitter: any;

  const mockCustomerId = new Types.ObjectId('650000000000000000000001');
  const mockSellerUserId = new Types.ObjectId('650000000000000000000002');
  const mockOtherSellerUserId = new Types.ObjectId('650000000000000000000003');
  const mockSellingEntityId = new Types.ObjectId('650000000000000000000010');
  const mockOtherEntityId = new Types.ObjectId('650000000000000000000020');
  const mockMainOrderId = new Types.ObjectId('650000000000000000000030');
  const mockEntityOrderId = new Types.ObjectId('650000000000000000000040');
  const mockReturnId = new Types.ObjectId('650000000000000000000050');
  const mockProductId = new Types.ObjectId('650000000000000000000060');

  const mockMainOrder = {
    _id: mockMainOrderId,
    customerId: mockCustomerId,
    orderNumber: 'ORD-1001',
    totalAmount: 500,
    status: 'CONFIRMED',
  };

  const mockEntityOrder = {
    _id: mockEntityOrderId,
    mainOrderId: mockMainOrderId,
    sellingEntityId: mockSellingEntityId,
    status: EntityOrderStatusEnum.DELIVERED,
    statusHistory: [
      {
        status: EntityOrderStatusEnum.DELIVERED,
        updatedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago (within 14 days window)
      },
    ],
  };

  const mockSellingEntity = {
    _id: mockSellingEntityId,
    tradeName: 'Tech Haven',
    legalName: 'Tech Haven Inc.',
    primaryOwnerId: mockSellerUserId,
    commissionPercentage: 10,
  };

  const mockOtherSellingEntity = {
    _id: mockOtherEntityId,
    tradeName: 'Foreign Store',
    legalName: 'Foreign Store LLC',
    primaryOwnerId: mockOtherSellerUserId,
    commissionPercentage: 10,
  };

  const mockReturnDoc = {
    _id: mockReturnId,
    orderId: mockMainOrderId,
    entityOrderId: mockEntityOrderId,
    customerId: mockCustomerId,
    sellingEntityId: mockSellingEntityId,
    items: [
      {
        productId: mockProductId,
        sku: 'KB-RGB-01',
        quantity: 2,
        price: 150,
        reason: 'Defective RGB lighting',
      },
    ],
    refundAmount: 300,
    refundMethod: RefundMethodEnum.ORIGINAL_PAYMENT,
    status: ReturnStatusEnum.INSPECTED,
    inspectionResult: InspectionResultEnum.RESALABLE,
  };

  beforeEach(async () => {
    connection = {
      startSession: jest.fn().mockReturnValue({
        startTransaction: jest.fn(),
        commitTransaction: jest.fn(),
        abortTransaction: jest.fn(),
        inTransaction: jest.fn().mockReturnValue(false),
      }),
      client: {
        topology: {
          description: {
            type: 'Single',
          },
        },
      },
    };

    returnRepo = {
      getOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((doc) =>
        Promise.resolve({
          _id: mockReturnId,
          ...doc,
        }),
      ),
      updateOne: jest.fn().mockImplementation((filter, update) =>
        Promise.resolve({
          _id: filter._id,
          ...update.$set,
        }),
      ),
      model: {
        find: jest.fn().mockReturnThis(),
        sort: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        populate: jest.fn().mockReturnThis(),
        lean: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([]),
        countDocuments: jest.fn().mockResolvedValue(0),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      },
    };

    mainOrderRepo = {
      getOne: jest.fn().mockResolvedValue(mockMainOrder),
    };

    entityOrderRepo = {
      getOne: jest.fn().mockResolvedValue(mockEntityOrder),
    };

    sellingEntityRepo = {
      getOne: jest.fn().mockResolvedValue(mockSellingEntity),
    };

    inventoryRepo = {
      restockAtomic: jest.fn().mockResolvedValue(true),
      getOne: jest.fn().mockResolvedValue(null),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    ledgerRepo = {
      create: jest.fn().mockImplementation((entry) =>
        Promise.resolve({
          _id: new Types.ObjectId(),
          ...entry,
        }),
      ),
    };

    paymentRepo = {
      getOne: jest.fn().mockResolvedValue(null),
    };

    productRepo = {
      getOne: jest.fn().mockResolvedValue(null),
    };

    paymentService = {
      refundOriginalPayment: jest.fn().mockResolvedValue({ success: true, refundId: 'REF-001' }),
      creditCustomerWallet: jest.fn().mockResolvedValue({ success: true, transactionId: 'WAL-001' }),
    };

    eventEmitter = {
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnService,
        { provide: getConnectionToken(), useValue: connection },
        { provide: ReturnRequestRepo, useValue: returnRepo },
        { provide: MainOrderRepo, useValue: mainOrderRepo },
        { provide: EntityOrderRepo, useValue: entityOrderRepo },
        { provide: SellingEntityRepo, useValue: sellingEntityRepo },
        { provide: InventoryRepo, useValue: inventoryRepo },
        { provide: LedgerRepo, useValue: ledgerRepo },
        { provide: PaymentRepo, useValue: paymentRepo },
        { provide: ProductRepo, useValue: productRepo },
        { provide: PaymentService, useValue: paymentService },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: getModelToken(ReturnRequest.name), useValue: returnRepo.model },
        { provide: getModelToken(MainOrder.name), useValue: {} },
        { provide: getModelToken(EntityOrder.name), useValue: {} },
        { provide: getModelToken(SellingEntity.name), useValue: {} },
        { provide: getModelToken(Inventory.name), useValue: {} },
        { provide: getModelToken(LedgerEntry.name), useValue: {} },
        { provide: getModelToken(Product.name), useValue: {} },
      ],
    }).compile();

    service = module.get<ReturnService>(ReturnService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReturnRequest (requestReturn)', () => {
    const validDto: CreateReturnRequestDto = {
      orderId: mockMainOrderId.toString(),
      entityOrderId: mockEntityOrderId.toString(),
      items: [
        {
          productId: mockProductId.toString(),
          sku: 'KB-RGB-01',
          quantity: 2,
          price: 150,
          reason: 'Defective switch on key A',
        },
      ],
      refundMethod: RefundMethodEnum.ORIGINAL_PAYMENT,
      customerReason: 'Product defective upon arrival',
    };

    it('should create return request successfully for delivered orders within eligible return window', async () => {
      mainOrderRepo.getOne.mockResolvedValue(mockMainOrder);
      entityOrderRepo.getOne.mockResolvedValue(mockEntityOrder);
      returnRepo.getOne.mockResolvedValue(null); // No existing active return

      const result = await service.createReturnRequest(
        mockCustomerId.toString(),
        validDto,
      );

      expect(result.success).toBe(true);
      expect(result.returnRequest).toBeDefined();
      expect(returnRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: mockMainOrderId,
          entityOrderId: mockEntityOrderId,
          customerId: mockCustomerId,
          sellingEntityId: mockSellingEntityId,
          status: ReturnStatusEnum.REQUESTED,
          refundAmount: 300,
          refundMethod: RefundMethodEnum.ORIGINAL_PAYMENT,
        }),
      );
    });

    it('should throw BadRequestException if order status is not DELIVERED', async () => {
      mainOrderRepo.getOne.mockResolvedValue(mockMainOrder);
      entityOrderRepo.getOne.mockResolvedValue({
        ...mockEntityOrder,
        status: EntityOrderStatusEnum.SHIPPED, // Not yet delivered!
      });

      await expect(
        service.createReturnRequest(mockCustomerId.toString(), validDto),
      ).rejects.toThrow(BadRequestException);

      expect(returnRepo.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if return request already exists for the item', async () => {
      mainOrderRepo.getOne.mockResolvedValue(mockMainOrder);
      entityOrderRepo.getOne.mockResolvedValue(mockEntityOrder);
      // Active return already in process
      returnRepo.getOne.mockResolvedValue({
        _id: new Types.ObjectId(),
        status: ReturnStatusEnum.REQUESTED,
      });

      await expect(
        service.createReturnRequest(mockCustomerId.toString(), validDto),
      ).rejects.toThrow(BadRequestException);

      expect(returnRepo.create).not.toHaveBeenCalled();
    });

    it('should throw ForbiddenException if customer attempts to return an order belonging to another user', async () => {
      mainOrderRepo.getOne.mockResolvedValue({
        ...mockMainOrder,
        customerId: new Types.ObjectId('650000000000000000000999'), // different customer
      });

      await expect(
        service.createReturnRequest(mockCustomerId.toString(), validDto),
      ).rejects.toThrow(ForbiddenException);

      expect(returnRepo.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if return window of 14 days has expired', async () => {
      mainOrderRepo.getOne.mockResolvedValue(mockMainOrder);
      entityOrderRepo.getOne.mockResolvedValue({
        ...mockEntityOrder,
        statusHistory: [
          {
            status: EntityOrderStatusEnum.DELIVERED,
            updatedAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000), // 20 days ago (>14 days)
          },
        ],
      });

      await expect(
        service.createReturnRequest(mockCustomerId.toString(), validDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('inspectReturnItem (inspectAndApprove)', () => {
    const inspectDto: InspectReturnRequestDto = {
      status: ReturnStatusEnum.INSPECTED,
      inspectionResult: InspectionResultEnum.RESALABLE,
      vendorNote: 'Item verified in factory sealed condition',
    };

    it('should allow vendor/admin to inspect item and set status to INSPECTED', async () => {
      returnRepo.getOne.mockResolvedValue(mockReturnDoc);
      sellingEntityRepo.getOne.mockResolvedValue(mockSellingEntity);

      const currentUser = {
        id: mockSellerUserId.toString(),
        role: RolesEnum.SELLER,
        sellingEntityId: mockSellingEntityId.toString(),
      };

      const result = await service.inspectReturnItem(
        mockSellerUserId.toString(),
        mockReturnId.toString(),
        inspectDto,
        currentUser,
      );

      expect(result.success).toBe(true);
      expect(returnRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockReturnId },
        {
          $set: expect.objectContaining({
            status: ReturnStatusEnum.INSPECTED,
            inspectionResult: InspectionResultEnum.RESALABLE,
            vendorNote: 'Item verified in factory sealed condition',
          }),
        },
      );
    });

    it('should throw ForbiddenException if another vendor attempts to inspect return', async () => {
      returnRepo.getOne.mockResolvedValue(mockReturnDoc); // belongs to mockSellingEntityId
      sellingEntityRepo.getOne.mockResolvedValue(mockSellingEntity); // owner is mockSellerUserId

      const foreignUser = {
        id: mockOtherSellerUserId.toString(),
        role: RolesEnum.SELLER,
        sellingEntityId: mockOtherEntityId.toString(), // different entity!
      };

      await expect(
        service.inspectReturnItem(
          mockOtherSellerUserId.toString(),
          mockReturnId.toString(),
          inspectDto,
          foreignUser,
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(returnRepo.updateOne).not.toHaveBeenCalled();
    });

    it('should allow platform ADMIN to inspect returns for any entity', async () => {
      returnRepo.getOne.mockResolvedValue(mockReturnDoc);

      const adminUser = {
        id: new Types.ObjectId('650000000000000000000001').toString(),
        role: RolesEnum.SUPER_ADMIN,
      };

      const result = await service.inspectReturnItem(
        adminUser.id,
        mockReturnId.toString(),
        inspectDto,
        adminUser,
      );

      expect(result.success).toBe(true);
      expect(returnRepo.updateOne).toHaveBeenCalled();
    });
  });

  describe('processRefund & Ledger Settlement', () => {
    it('should record REFUND_DEBIT ledger entry against vendor wallet upon refund execution', async () => {
      returnRepo.getOne.mockResolvedValue(mockReturnDoc);
      sellingEntityRepo.getOne.mockResolvedValue(mockSellingEntity);

      const sellerContext = {
        id: mockSellerUserId.toString(),
        role: RolesEnum.SELLER,
        sellingEntityId: mockSellingEntityId.toString(),
      };

      const result = await service.processRefund(
        mockSellerUserId.toString(),
        mockReturnId.toString(),
        sellerContext,
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(ReturnStatusEnum.REFUNDED);

      // Refund amount is 300, commission is 10% (30), netSellerDeduction = 270
      expect(ledgerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sellingEntityId: mockSellingEntityId,
          orderId: mockMainOrderId,
          entityOrderId: mockEntityOrderId,
          entryType: LedgerMovementTypeEnum.REFUND_DEBIT,
          account: LedgerAccountEnum.VENDOR_PAYABLE,
          type: LedgerEntryTypeEnum.DEBIT,
          amount: -270,
          currency: 'EGP',
          status: LedgerEntryStatusEnum.SETTLED,
        }),
        undefined,
      );

      // Commission reversal entry: 30 back to seller credit
      expect(ledgerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT,
          account: LedgerAccountEnum.PLATFORM_COMMISSION,
          type: LedgerEntryTypeEnum.CREDIT,
          amount: 30,
        }),
        undefined,
      );
    });

    it('should restore inventory stock if returned item is in resellable condition', async () => {
      returnRepo.getOne.mockResolvedValue({
        ...mockReturnDoc,
        status: ReturnStatusEnum.INSPECTED,
        inspectionResult: InspectionResultEnum.RESALABLE,
        items: [
          {
            productId: mockProductId,
            sku: 'KB-RGB-01',
            quantity: 2,
            price: 150,
          },
        ],
      });
      sellingEntityRepo.getOne.mockResolvedValue(mockSellingEntity);

      await service.processRefund(
        mockSellerUserId.toString(),
        mockReturnId.toString(),
        { id: mockSellerUserId.toString(), role: RolesEnum.SELLER },
      );

      expect(inventoryRepo.restockAtomic).toHaveBeenCalledWith(
        'KB-RGB-01',
        2,
        undefined,
      );
    });

    it('should not restock inventory if returned item is damaged or scrapped', async () => {
      returnRepo.getOne.mockResolvedValue({
        ...mockReturnDoc,
        status: ReturnStatusEnum.INSPECTED,
        inspectionResult: InspectionResultEnum.DAMAGED_DISCARD,
      });
      sellingEntityRepo.getOne.mockResolvedValue(mockSellingEntity);

      await service.processRefund(
        mockSellerUserId.toString(),
        mockReturnId.toString(),
        { id: mockSellerUserId.toString(), role: RolesEnum.SELLER },
      );

      expect(inventoryRepo.restockAtomic).not.toHaveBeenCalled();
    });

    it('should process refund correctly for both WALLET_CREDIT and ORIGINAL_PAYMENT methods', async () => {
      sellingEntityRepo.getOne.mockResolvedValue(mockSellingEntity);

      // 1. ORIGINAL_PAYMENT method
      returnRepo.getOne.mockResolvedValue({
        ...mockReturnDoc,
        refundMethod: RefundMethodEnum.ORIGINAL_PAYMENT,
      });

      await service.processRefund(
        mockSellerUserId.toString(),
        mockReturnId.toString(),
        { id: mockSellerUserId.toString(), role: RolesEnum.SELLER },
      );

      expect(paymentService.refundOriginalPayment).toHaveBeenCalledWith(
        mockMainOrderId,
        300,
        undefined,
      );

      // 2. WALLET_CREDIT method
      returnRepo.getOne.mockResolvedValue({
        ...mockReturnDoc,
        refundMethod: RefundMethodEnum.WALLET_CREDIT,
      });

      await service.processRefund(
        mockSellerUserId.toString(),
        mockReturnId.toString(),
        { id: mockSellerUserId.toString(), role: RolesEnum.SELLER },
      );

      expect(paymentService.creditCustomerWallet).toHaveBeenCalledWith(
        mockCustomerId,
        300,
        undefined,
      );
    });

    it('should transition return request status to COMPLETED/REFUNDED', async () => {
      returnRepo.getOne.mockResolvedValue(mockReturnDoc);
      sellingEntityRepo.getOne.mockResolvedValue(mockSellingEntity);

      const result = await service.processRefund(
        mockSellerUserId.toString(),
        mockReturnId.toString(),
        { id: mockSellerUserId.toString(), role: RolesEnum.SELLER },
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(ReturnStatusEnum.REFUNDED);

      expect(returnRepo.model.updateOne).toHaveBeenCalledWith(
        { _id: mockReturnId },
        {
          $set: {
            status: ReturnStatusEnum.REFUNDED,
            refundedAt: expect.any(Date),
          },
        },
        undefined,
      );

      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'return.refunded',
        expect.objectContaining({
          returnId: mockReturnId,
          refundAmount: 300,
          status: ReturnStatusEnum.REFUNDED,
        }),
      );
    });

    it('should throw BadRequestException if refund is executed on an uninspected return', async () => {
      returnRepo.getOne.mockResolvedValue({
        ...mockReturnDoc,
        status: ReturnStatusEnum.REQUESTED, // Not yet inspected or approved!
      });

      await expect(
        service.processRefund(
          mockSellerUserId.toString(),
          mockReturnId.toString(),
          { id: mockSellerUserId.toString(), role: RolesEnum.SELLER },
        ),
      ).rejects.toThrow(BadRequestException);

      expect(ledgerRepo.create).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if refund has already been processed', async () => {
      returnRepo.getOne.mockResolvedValue({
        ...mockReturnDoc,
        status: ReturnStatusEnum.REFUNDED, // Already refunded
      });

      await expect(
        service.processRefund(
          mockSellerUserId.toString(),
          mockReturnId.toString(),
          { id: mockSellerUserId.toString(), role: RolesEnum.SELLER },
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});

