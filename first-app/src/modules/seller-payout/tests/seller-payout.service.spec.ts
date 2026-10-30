import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { getConnectionToken, getModelToken } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import { SellerPayoutService } from '../seller-payout.service';
import { SellerPayoutMethodRepo } from '../../../models/payout/seller-payout-method.repository';
import { PayoutRequestRepo } from '../../../models/payout/payout-request.repository';
import { LedgerRepo } from '../../../models/ledger/ledger.repository';
import { SellingEntityRepo } from '../../../models/selling-entity/selling-entity.repository';
import { EscrowRepo } from '../../../models/escrow/escrow.repository';
import { MainOrderRepo } from '../../../models/order/main-order.repository';
import {
  PayoutRequestStatusEnum,
  PayoutRequest,
} from '../../../models/payout/payout-request.schema';
import {
  LedgerMovementTypeEnum,
  LedgerEntryStatusEnum,
  LedgerEntry,
} from '../../../models/ledger/ledger-entry.schema';
import { SellingEntity } from '../../../models/selling-entity/selling-entity.schema';
import { PayoutMethodTypeEnum } from '../../../models/payout/seller-payout-method.schema';
import { EscrowStatusEnum } from '../../../common/enums/escrow-status.enum';

describe('SellerPayoutService', () => {
  let service: SellerPayoutService;
  let ledgerRepo: any;
  let payoutRequestRepo: any;
  let payoutMethodRepo: any;
  let escrowRepo: any;
  let sellingEntityRepo: any;
  let mainOrderRepo: any;

  const mockEntityId = new Types.ObjectId('650000000000000000000001');
  const mockMethodId = new Types.ObjectId('650000000000000000000002');
  const mockPayoutId = new Types.ObjectId('650000000000000000000003');

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

  const createMockQuery = (resolvedValue: any) => {
    const query: any = {};
    query.sort = jest.fn().mockReturnValue(query);
    query.skip = jest.fn().mockReturnValue(query);
    query.limit = jest.fn().mockReturnValue(query);
    query.populate = jest.fn().mockReturnValue(query);
    query.lean = jest.fn().mockReturnValue(query);
    query.exec = jest.fn().mockResolvedValue(resolvedValue);
    return query;
  };

  beforeEach(async () => {
    const mockLedgerModel = {
      aggregate: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const mockPayoutRequestModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const mockPayoutMethodModel = {
      find: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      updateMany: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    const mockSellingEntityModel = {
      findOne: jest.fn(),
    };

    ledgerRepo = {
      model: mockLedgerModel,
      create: jest.fn().mockImplementation((data) => Promise.resolve({ _id: new Types.ObjectId(), ...data })),
      getOne: jest.fn(),
      getAll: jest.fn().mockResolvedValue([]),
    };

    payoutRequestRepo = {
      model: mockPayoutRequestModel,
      create: jest.fn().mockImplementation((data) => Promise.resolve({ _id: mockPayoutId, ...data })),
      getOne: jest.fn(),
      getAll: jest.fn().mockResolvedValue([]),
      updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    };

    payoutMethodRepo = {
      model: mockPayoutMethodModel,
      create: jest.fn().mockImplementation((data) => Promise.resolve({ _id: mockMethodId, ...data })),
      getOne: jest.fn(),
      getAll: jest.fn().mockResolvedValue([]),
    };

    sellingEntityRepo = {
      model: mockSellingEntityModel,
      getOne: jest.fn(),
      getAll: jest.fn().mockResolvedValue([]),
    };

    escrowRepo = {
      getAll: jest.fn().mockResolvedValue([]),
      getOne: jest.fn(),
    };

    mainOrderRepo = {
      getOne: jest.fn(),
      getAll: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SellerPayoutService,
        { provide: getConnectionToken(), useValue: mockConnection },
        { provide: SellerPayoutMethodRepo, useValue: payoutMethodRepo },
        { provide: PayoutRequestRepo, useValue: payoutRequestRepo },
        { provide: LedgerRepo, useValue: ledgerRepo },
        { provide: SellingEntityRepo, useValue: sellingEntityRepo },
        { provide: EscrowRepo, useValue: escrowRepo },
        { provide: MainOrderRepo, useValue: mainOrderRepo },
        { provide: getModelToken(LedgerEntry.name), useValue: mockLedgerModel },
        { provide: getModelToken(PayoutRequest.name), useValue: mockPayoutRequestModel },
        { provide: getModelToken(SellingEntity.name), useValue: mockSellingEntityModel },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EventEmitter2, useValue: { emit: jest.fn() } },
      ],
    }).compile();

    service = module.get<SellerPayoutService>(SellerPayoutService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolveSellingEntityId', () => {
    it('should resolve sellingEntityId from explicit entity ID', async () => {
      sellingEntityRepo.getOne.mockResolvedValue({ _id: mockEntityId });
      const id = await service.resolveSellingEntityId(mockEntityId.toString());
      expect(id).toEqual(mockEntityId);
    });

    it('should resolve sellingEntityId from owner ID', async () => {
      const ownerId = new Types.ObjectId();
      sellingEntityRepo.getOne.mockResolvedValue({ _id: mockEntityId });

      const id = await service.resolveSellingEntityId(undefined, ownerId.toString());
      expect(id).toEqual(mockEntityId);
    });

    it('should throw NotFoundException if entity is not found', async () => {
      sellingEntityRepo.getOne.mockResolvedValue(null);
      await expect(service.resolveSellingEntityId('invalidId')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('addPayoutMethod', () => {
    it('should add a valid Bank Account payout method', async () => {
      payoutMethodRepo.model.countDocuments.mockResolvedValue(0);
      const dto = {
        type: PayoutMethodTypeEnum.BANK_ACCOUNT,
        details: {
          accountHolderName: 'Ahmed Ali',
          bankName: 'CIB',
          iban: 'EG12345678901234567890',
        },
      };

      const result = await service.addPayoutMethod(mockEntityId, dto as any);
      expect(result).toBeDefined();
      expect(payoutMethodRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: PayoutMethodTypeEnum.BANK_ACCOUNT,
          isDefault: true,
        }),
      );
    });

    it('should throw BadRequestException if Bank Account is missing required fields', async () => {
      const dto = {
        type: PayoutMethodTypeEnum.BANK_ACCOUNT,
        details: { accountHolderName: 'Ahmed' },
      };
      await expect(
        service.addPayoutMethod(mockEntityId, dto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add a valid Vodafone Cash payout method', async () => {
      payoutMethodRepo.model.countDocuments.mockResolvedValue(1);
      const dto = {
        type: PayoutMethodTypeEnum.VODAFONE_CASH,
        details: { walletNumber: '01012345678' },
        isDefault: true,
      };

      const result = await service.addPayoutMethod(mockEntityId, dto as any);
      expect(result).toBeDefined();
      expect(payoutMethodRepo.model.updateMany).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid Egyptian mobile wallet number', async () => {
      const dto = {
        type: PayoutMethodTypeEnum.VODAFONE_CASH,
        details: { walletNumber: '0199999999' },
      };
      await expect(
        service.addPayoutMethod(mockEntityId, dto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should add a valid InstaPay payout method', async () => {
      payoutMethodRepo.model.countDocuments.mockResolvedValue(0);
      const dto = {
        type: PayoutMethodTypeEnum.INSTAPAY,
        details: { instaPayAddress: 'user@instapay' },
      };

      const result = await service.addPayoutMethod(mockEntityId, dto as any);
      expect(result).toBeDefined();
    });

    it('should throw BadRequestException for invalid InstaPay address', async () => {
      const dto = {
        type: PayoutMethodTypeEnum.INSTAPAY,
        details: { instaPayAddress: 'ab' },
      };
      await expect(
        service.addPayoutMethod(mockEntityId, dto as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if details object is missing', async () => {
      await expect(
        service.addPayoutMethod(mockEntityId, { type: PayoutMethodTypeEnum.INSTAPAY } as any),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('getPayoutMethods and setDefaultPayoutMethod', () => {
    it('should list all payout methods', async () => {
      const mockMethods = [{ _id: mockMethodId, type: PayoutMethodTypeEnum.BANK_ACCOUNT }];
      payoutMethodRepo.model.find.mockReturnValue(createMockQuery(mockMethods));

      const list = await service.getPayoutMethods(mockEntityId);
      expect(list).toEqual(mockMethods);
    });

    it('should set payout method as default', async () => {
      payoutMethodRepo.getOne.mockResolvedValue({
        _id: mockMethodId,
        sellingEntityId: mockEntityId,
        isDefault: true,
      });

      const updated = await service.setDefaultPayoutMethod(mockEntityId, mockMethodId.toString());
      expect(updated.isDefault).toBe(true);
      expect(payoutMethodRepo.model.updateMany).toHaveBeenCalled();
      expect(payoutMethodRepo.model.updateOne).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid method ID string', async () => {
      await expect(
        service.setDefaultPayoutMethod(mockEntityId, 'invalid-id'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if payout method is not found', async () => {
      payoutMethodRepo.getOne.mockResolvedValue(null);
      await expect(
        service.setDefaultPayoutMethod(mockEntityId, mockMethodId.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getWalletBalance', () => {
    it('should return accurate available balance from ledger entries', async () => {
      ledgerRepo.model.aggregate.mockResolvedValue([
        {
          availableOrderCredit: 5000,
          heldEscrowBalance: 2000,
          refundDebit: 0,
          payoutDebit: 0,
          codDues: 0,
        },
      ]);
      payoutRequestRepo.getAll.mockResolvedValue([]);

      const balance = await service.getWalletBalance(mockEntityId);

      expect(balance.availableBalance).toBe(5000);
      expect(balance.pendingBalance).toBe(2000);
      expect(balance.withdrawnBalance).toBe(0);
      expect(balance.platformDues).toBe(0);
      expect(balance.currency).toBe('EGP');
    });

    it('should ignore HELD_ESCROW entries in available balance', async () => {
      ledgerRepo.model.aggregate.mockResolvedValue([
        {
          availableOrderCredit: 3000,
          heldEscrowBalance: 7000,
          refundDebit: 0,
          payoutDebit: 0,
          codDues: 0,
        },
      ]);
      payoutRequestRepo.getAll.mockResolvedValue([]);

      const balance = await service.getWalletBalance(mockEntityId);

      expect(balance.availableBalance).toBe(3000);
      expect(balance.pendingBalance).toBe(7000);
      expect(balance.withdrawnBalance).toBe(0);
    });

    it('should deduct REFUND_DEBIT correctly', async () => {
      ledgerRepo.model.aggregate.mockResolvedValue([
        {
          availableOrderCredit: 5000,
          heldEscrowBalance: 0,
          refundDebit: 1200,
          payoutDebit: 0,
          codDues: 0,
        },
      ]);
      payoutRequestRepo.getAll.mockResolvedValue([]);

      const balance = await service.getWalletBalance(mockEntityId);

      expect(balance.availableBalance).toBe(3800);
    });

    it('should deduct COD PLATFORM_FEE_DEBIT from available balance', async () => {
      ledgerRepo.model.aggregate.mockResolvedValue([
        {
          availableOrderCredit: 5000,
          heldEscrowBalance: 0,
          refundDebit: 0,
          payoutDebit: 0,
          codDues: 800,
        },
      ]);
      payoutRequestRepo.getAll.mockResolvedValue([]);

      const balance = await service.getWalletBalance(mockEntityId);

      expect(balance.availableBalance).toBe(4200);
      expect(balance.platformDues).toBe(0);
    });

    it('should calculate positive platformDues when COD dues exceed net available credit', async () => {
      ledgerRepo.model.aggregate.mockResolvedValue([
        {
          availableOrderCredit: 1000,
          heldEscrowBalance: 0,
          refundDebit: 200,
          payoutDebit: 0,
          codDues: 1500,
        },
      ]);
      payoutRequestRepo.getAll.mockResolvedValue([]);

      const balance = await service.getWalletBalance(mockEntityId);

      // netCreditAvailable = 1000 - 200 = 800. Since 800 < 1500:
      // availableBalance = 0, platformDues = 1500 - 800 = 700
      expect(balance.availableBalance).toBe(0);
      expect(balance.platformDues).toBe(700);
    });

    it('should fallback to Escrow collection when no order credit ledger entries exist', async () => {
      ledgerRepo.model.aggregate.mockResolvedValue([
        {
          availableOrderCredit: 0,
          heldEscrowBalance: 0,
          refundDebit: 0,
          payoutDebit: 0,
          codDues: 0,
        },
      ]);
      escrowRepo.getAll.mockResolvedValue([
        { status: EscrowStatusEnum.HELD, netAmount: 1200 },
        { status: EscrowStatusEnum.RELEASED, netAmount: 2500 },
      ]);
      payoutRequestRepo.getAll.mockResolvedValue([]);

      const balance = await service.getWalletBalance(mockEntityId);

      expect(balance.pendingBalance).toBe(1200);
      expect(balance.availableBalance).toBe(2500);
    });

    it('should deduct completed and pending PAYOUT_DEBIT', async () => {
      ledgerRepo.model.aggregate.mockResolvedValue([
        {
          availableOrderCredit: 10000,
          heldEscrowBalance: 0,
          refundDebit: 0,
          payoutDebit: 2000,
          codDues: 0,
        },
      ]);
      payoutRequestRepo.getAll
        .mockResolvedValueOnce([{ amount: 1500 }]) // Pending / Processing requests
        .mockResolvedValueOnce([{ amount: 2000 }]); // Completed payouts

      const balance = await service.getWalletBalance(mockEntityId);

      expect(balance.availableBalance).toBe(6500);
      expect(balance.withdrawnBalance).toBe(2000);
    });

    it('should return 0 when entity has no ledger entries', async () => {
      ledgerRepo.model.aggregate.mockResolvedValue([]);
      escrowRepo.getAll.mockResolvedValue([]);
      payoutRequestRepo.getAll.mockResolvedValue([]);

      const balance = await service.getWalletBalance(mockEntityId);

      expect(balance.availableBalance).toBe(0);
      expect(balance.pendingBalance).toBe(0);
      expect(balance.withdrawnBalance).toBe(0);
      expect(balance.platformDues).toBe(0);
    });
  });

  describe('requestPayout', () => {
    const validDto = {
      payoutMethodId: mockMethodId.toString(),
      amount: 1000,
    };

    it('should throw BadRequestException if amount is below minimum threshold', async () => {
      await expect(
        service.requestPayout(mockEntityId, {
          payoutMethodId: mockMethodId.toString(),
          amount: 200,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if payout method ID is invalid', async () => {
      await expect(
        service.requestPayout(mockEntityId, {
          payoutMethodId: 'invalid-id',
          amount: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if payout method is not found for entity', async () => {
      payoutMethodRepo.getOne.mockResolvedValue(null);
      await expect(
        service.requestPayout(mockEntityId, validDto),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if an active PENDING payout already exists', async () => {
      payoutMethodRepo.getOne.mockResolvedValue({
        _id: mockMethodId,
        type: PayoutMethodTypeEnum.BANK_ACCOUNT,
        details: { bankName: 'CIB' },
      });
      payoutRequestRepo.getOne.mockResolvedValue({
        _id: new Types.ObjectId(),
        status: PayoutRequestStatusEnum.PENDING,
        amount: 1000,
      });

      await expect(
        service.requestPayout(mockEntityId, validDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if requested amount exceeds available balance', async () => {
      payoutMethodRepo.getOne.mockResolvedValue({
        _id: mockMethodId,
        type: PayoutMethodTypeEnum.BANK_ACCOUNT,
        details: { bankName: 'CIB' },
      });
      payoutRequestRepo.getOne.mockResolvedValue(null);

      jest.spyOn(service, 'getWalletBalance').mockResolvedValue({
        pendingBalance: 0,
        availableBalance: 500,
        withdrawnBalance: 0,
        platformDues: 0,
        currency: 'EGP',
      });

      await expect(
        service.requestPayout(mockEntityId, {
          payoutMethodId: mockMethodId.toString(),
          amount: 1000,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should successfully create payout request and debit ledger on valid input', async () => {
      payoutMethodRepo.getOne.mockResolvedValue({
        _id: mockMethodId,
        type: PayoutMethodTypeEnum.BANK_ACCOUNT,
        details: { bankName: 'CIB' },
      });
      payoutRequestRepo.getOne.mockResolvedValue(null);

      jest.spyOn(service, 'getWalletBalance').mockResolvedValue({
        pendingBalance: 0,
        availableBalance: 3000,
        withdrawnBalance: 0,
        platformDues: 0,
        currency: 'EGP',
      });

      const result = await service.requestPayout(mockEntityId, validDto);

      expect(result.success).toBe(true);
      expect(result.newBalance).toBe(2000);
      expect(result.payoutRequest).toBeDefined();
      expect(payoutRequestRepo.create).toHaveBeenCalled();
      expect(ledgerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          entryType: LedgerMovementTypeEnum.PAYOUT_DEBIT,
          amount: 1000,
          balanceAfter: 2000,
          status: LedgerEntryStatusEnum.SETTLED,
        }),
        undefined,
      );
    });
  });

  describe('getLedgerHistory and getPayoutHistory', () => {
    it('should apply pagination and filters correctly and return paginated data', async () => {
      const mockEntries = [
        {
          _id: new Types.ObjectId(),
          entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
          amount: 1500,
          status: LedgerEntryStatusEnum.AVAILABLE,
        },
      ];

      ledgerRepo.model.find.mockReturnValue(createMockQuery(mockEntries));
      ledgerRepo.model.countDocuments.mockResolvedValue(25);

      const result = await service.getLedgerHistory(mockEntityId, 2, 10, 'AVAILABLE');

      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(25);
      expect(result.totalPages).toBe(3);
      expect(result.entries).toEqual(mockEntries);
      expect(ledgerRepo.model.find).toHaveBeenCalledWith({
        sellingEntityId: mockEntityId,
        status: 'AVAILABLE',
      });
    });

    it('should retrieve payout history for a selling entity', async () => {
      const mockHistory = [{ _id: mockPayoutId, amount: 2000 }];
      payoutRequestRepo.model.find.mockReturnValue(createMockQuery(mockHistory));

      const history = await service.getPayoutHistory(mockEntityId);
      expect(history).toEqual(mockHistory);
    });
  });

  describe('processPayout', () => {
    it('should throw NotFoundException if payout request does not exist', async () => {
      payoutRequestRepo.getOne.mockResolvedValue(null);
      await expect(
        service.processPayout(mockPayoutId, 'APPROVE'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if payout request is already completed', async () => {
      payoutRequestRepo.getOne.mockResolvedValue({
        _id: mockPayoutId,
        status: PayoutRequestStatusEnum.COMPLETED,
      });
      await expect(
        service.processPayout(mockPayoutId, 'APPROVE'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should mark payout as PAID and settle ledger entry upon approval', async () => {
      const mockPendingPayout = {
        _id: mockPayoutId,
        sellingEntityId: mockEntityId,
        amount: 1000,
        status: PayoutRequestStatusEnum.PENDING,
        gatewayReference: 'GW-REF-999',
      };

      payoutRequestRepo.getOne
        .mockResolvedValueOnce(mockPendingPayout)
        .mockResolvedValueOnce({
          ...mockPendingPayout,
          status: PayoutRequestStatusEnum.COMPLETED,
        });

      const result = await service.processPayout(mockPayoutId, 'APPROVE', 'Bank wire completed');

      expect(result.success).toBe(true);
      expect(payoutRequestRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockPayoutId },
        expect.objectContaining({
          status: PayoutRequestStatusEnum.COMPLETED,
          adminNotes: 'Bank wire completed',
        }),
      );
      expect(ledgerRepo.model.updateOne).toHaveBeenCalledWith(
        {
          reference: 'GW-REF-999',
          entryType: LedgerMovementTypeEnum.PAYOUT_DEBIT,
        },
        {
          $set: { status: LedgerEntryStatusEnum.SETTLED },
        },
      );
    });

    it('should mark payout as REJECTED and create REVERSAL_CREDIT ledger entry upon rejection', async () => {
      const mockPendingPayout = {
        _id: mockPayoutId,
        sellingEntityId: mockEntityId,
        amount: 1500,
        status: PayoutRequestStatusEnum.PENDING,
        gatewayReference: 'GW-REF-888',
      };

      payoutRequestRepo.getOne
        .mockResolvedValueOnce(mockPendingPayout)
        .mockResolvedValueOnce({
          ...mockPendingPayout,
          status: PayoutRequestStatusEnum.REJECTED,
        });

      const result = await service.processPayout(mockPayoutId, 'REJECT', 'Incorrect IBAN');

      expect(result.success).toBe(true);
      expect(payoutRequestRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockPayoutId },
        expect.objectContaining({
          status: PayoutRequestStatusEnum.REJECTED,
          adminNotes: 'Incorrect IBAN',
        }),
      );
      expect(ledgerRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          sellingEntityId: mockEntityId,
          entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
          amount: 1500,
          status: LedgerEntryStatusEnum.AVAILABLE,
          reference: 'REV-GW-REF-888',
        }),
      );
    });
  });
});
