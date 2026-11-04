import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { AuditService } from './audit.service';
import { AuditLogRepo } from '../../models/audit-log/audit-log.repository';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

describe('AuditService', () => {
  let service: AuditService;
  let auditLogRepo: jest.Mocked<AuditLogRepo>;

  beforeEach(async () => {
    const mockAuditLogRepo = {
      create: jest.fn(),
      getAll: jest.fn(),
      getOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        {
          provide: AuditLogRepo,
          useValue: mockAuditLogRepo,
        },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    auditLogRepo = module.get(AuditLogRepo);
  });

  describe('logAction', () => {
    it('should create audit log with valid ObjectId actorId', async () => {
      const validActorId = new Types.ObjectId().toString();
      const mockDto = {
        actorId: validActorId,
        action: AuditActionEnum.CREATE,
        targetEntity: 'Product',
        targetId: 'prod123',
        previousState: undefined,
        newState: { name: 'Item A' },
        ipAddress: '127.0.0.1',
      };

      auditLogRepo.create.mockResolvedValue({ _id: 'auditId', ...mockDto } as any);

      const result = await service.logAction(mockDto);

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: new Types.ObjectId(validActorId),
          action: AuditActionEnum.CREATE,
          targetEntity: 'Product',
          targetId: 'prod123',
          ipAddress: '127.0.0.1',
        }),
      );
      expect(result).toBeDefined();
    });

    it('should fallback to zero ObjectId when actorId is invalid', async () => {
      const mockDto = {
        actorId: 'non-object-id',
        action: AuditActionEnum.UPDATE,
        targetEntity: 'Brand',
        targetId: 'brand123',
      };

      auditLogRepo.create.mockResolvedValue({ _id: 'auditId' } as any);

      await service.logAction(mockDto);

      expect(auditLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          actorId: new Types.ObjectId('000000000000000000000000'),
          targetId: 'brand123',
        }),
      );
    });
  });

  describe('handleAuditLogEvent', () => {
    it('should delegate event to logAction', async () => {
      const logActionSpy = jest.spyOn(service, 'logAction').mockResolvedValue({} as any);

      const event = {
        actorId: new Types.ObjectId().toString(),
        action: AuditActionEnum.STATUS_CHANGE,
        targetEntity: 'Order',
        targetId: 'order123',
        previousState: { status: 'PENDING' },
        newState: { status: 'CONFIRMED' },
        ipAddress: '10.0.0.1',
      };

      await service.handleAuditLogEvent(event);

      expect(logActionSpy).toHaveBeenCalledWith(event);
    });
  });

  describe('getAuditLogsByEntity', () => {
    it('should query repository with case-insensitive targetEntity filter', async () => {
      auditLogRepo.getAll.mockResolvedValue([
        { targetEntity: 'Product', action: AuditActionEnum.CREATE },
      ] as any);

      const results = await service.getAuditLogsByEntity('product');

      expect(auditLogRepo.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          targetEntity: expect.any(RegExp),
        }),
        undefined,
        { sort: { createdAt: -1 } },
      );
      expect(results).toHaveLength(1);
    });

    it('should include targetId in filter when provided', async () => {
      auditLogRepo.getAll.mockResolvedValue([]);

      await service.getAuditLogsByEntity('Order', 'ord999');

      expect(auditLogRepo.getAll).toHaveBeenCalledWith(
        expect.objectContaining({
          targetId: 'ord999',
        }),
        undefined,
        { sort: { createdAt: -1 } },
      );
    });
  });

  describe('getAuditLogsByActor', () => {
    it('should query repository when actorId is a valid ObjectId', async () => {
      const validActorId = new Types.ObjectId().toString();
      auditLogRepo.getAll.mockResolvedValue([{ actorId: new Types.ObjectId(validActorId) }] as any);

      const results = await service.getAuditLogsByActor(validActorId);

      expect(auditLogRepo.getAll).toHaveBeenCalledWith(
        { actorId: new Types.ObjectId(validActorId) },
        undefined,
        { sort: { createdAt: -1 } },
      );
      expect(results).toHaveLength(1);
    });

    it('should return empty array without querying repository when actorId is invalid', async () => {
      const results = await service.getAuditLogsByActor('invalid-id');

      expect(results).toEqual([]);
      expect(auditLogRepo.getAll).not.toHaveBeenCalled();
    });
  });
});

