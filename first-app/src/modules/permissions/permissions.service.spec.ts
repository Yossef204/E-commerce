import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Types } from 'mongoose';
import { PermissionsService } from './permissions.service';
import { PermissionRepo } from '../../models/permission/permission.repository';

describe('PermissionsService', () => {
  let service: PermissionsService;
  let permissionRepo: {
    upsertUserPermissions: jest.Mock;
    getAll: jest.Mock;
    getOne: jest.Mock;
    updateOne: jest.Mock;
    deleteOne: jest.Mock;
  };
  let cacheManager: {
    get: jest.Mock;
    set: jest.Mock;
    store?: any;
  };

  const mockPermissionId = new Types.ObjectId('650000000000000000000077');
  const mockUserId = new Types.ObjectId('650000000000000000000088');

  const mockPermissionDoc = {
    _id: mockPermissionId,
    userId: mockUserId,
    permissions: ['products.create', 'products.read_own'],
  };

  beforeEach(async () => {
    permissionRepo = {
      upsertUserPermissions: jest.fn(),
      getAll: jest.fn(),
      getOne: jest.fn(),
      updateOne: jest.fn(),
      deleteOne: jest.fn(),
    };

    cacheManager = {
      get: jest.fn().mockResolvedValue('1'),
      set: jest.fn().mockResolvedValue(undefined),
      store: {
        client: {
          incr: jest.fn().mockResolvedValue(2),
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        {
          provide: PermissionRepo,
          useValue: permissionRepo,
        },
        {
          provide: CACHE_MANAGER,
          useValue: cacheManager,
        },
      ],
    }).compile();

    service = module.get<PermissionsService>(PermissionsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('should upsert permissions and invalidate tokenVersion in cache', async () => {
      permissionRepo.upsertUserPermissions.mockResolvedValue(mockPermissionDoc);

      const dto = {
        userId: mockUserId.toString(),
        permissions: ['products.create', 'products.read_own'],
      };

      const result = await service.create(dto);

      expect(permissionRepo.upsertUserPermissions).toHaveBeenCalledWith(
        dto.userId,
        dto.permissions,
      );
      expect(cacheManager.store.client.incr).toHaveBeenCalledWith(
        `auth:token_version:${mockUserId.toString()}`,
      );
      expect(result).toEqual(mockPermissionDoc);
    });
  });

  describe('findAll', () => {
    it('should return all permission documents', async () => {
      permissionRepo.getAll.mockResolvedValue([mockPermissionDoc]);

      const result = await service.findAll();

      expect(permissionRepo.getAll).toHaveBeenCalledWith({});
      expect(result).toEqual([mockPermissionDoc]);
    });
  });

  describe('findByUserId', () => {
    it('should return permissions for specified userId', async () => {
      permissionRepo.getOne.mockResolvedValue(mockPermissionDoc);

      const result = await service.findByUserId(mockUserId.toString());

      expect(permissionRepo.getOne).toHaveBeenCalledWith({
        userId: mockUserId,
      });
      expect(result).toEqual(mockPermissionDoc);
    });

    it('should throw NotFoundException if permissions not found for user', async () => {
      permissionRepo.getOne.mockResolvedValue(null);

      await expect(
        service.findByUserId(mockUserId.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findOne', () => {
    it('should return permission document by id', async () => {
      permissionRepo.getOne.mockResolvedValue(mockPermissionDoc);

      const result = await service.findOne(mockPermissionId.toString());

      expect(permissionRepo.getOne).toHaveBeenCalledWith({
        _id: mockPermissionId,
      });
      expect(result).toEqual(mockPermissionDoc);
    });

    it('should throw NotFoundException if record not found by id', async () => {
      permissionRepo.getOne.mockResolvedValue(null);

      await expect(
        service.findOne(mockPermissionId.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('update', () => {
    it('should update permissions and invalidate token version for user', async () => {
      const updatedDoc = {
        ...mockPermissionDoc,
        permissions: ['products.create', 'products.delete'],
      };
      permissionRepo.updateOne.mockResolvedValue(updatedDoc);

      const result = await service.update(mockPermissionId.toString(), {
        permissions: ['products.create', 'products.delete'],
      });

      expect(permissionRepo.updateOne).toHaveBeenCalledWith(
        { _id: mockPermissionId },
        { $set: { permissions: ['products.create', 'products.delete'] } },
      );
      expect(cacheManager.store.client.incr).toHaveBeenCalledWith(
        `auth:token_version:${mockUserId.toString()}`,
      );
      expect(result).toEqual(updatedDoc);
    });

    it('should throw NotFoundException if document to update does not exist', async () => {
      permissionRepo.updateOne.mockResolvedValue(null);

      await expect(
        service.update(mockPermissionId.toString(), { permissions: [] }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('remove', () => {
    it('should delete permission document and invalidate tokenVersion', async () => {
      permissionRepo.getOne.mockResolvedValue(mockPermissionDoc);
      permissionRepo.deleteOne.mockResolvedValue(mockPermissionDoc);

      const result = await service.remove(mockPermissionId.toString());

      expect(permissionRepo.getOne).toHaveBeenCalledWith({
        _id: mockPermissionId,
      });
      expect(permissionRepo.deleteOne).toHaveBeenCalledWith({
        _id: mockPermissionId,
      });
      expect(cacheManager.store.client.incr).toHaveBeenCalledWith(
        `auth:token_version:${mockUserId.toString()}`,
      );
      expect(result).toEqual({
        success: true,
        message: `Permission record #${mockPermissionId.toString()} deleted successfully`,
      });
    });

    it('should throw NotFoundException if document to remove is not found', async () => {
      permissionRepo.getOne.mockResolvedValue(null);
      permissionRepo.deleteOne.mockResolvedValue(null);

      await expect(
        service.remove(mockPermissionId.toString()),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
