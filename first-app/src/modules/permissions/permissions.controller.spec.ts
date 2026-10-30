import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Reflector } from '@nestjs/core';
import { PermissionsController } from './permissions.controller';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';

describe('PermissionsController', () => {
  let controller: PermissionsController;
  let permissionsService: {
    create: jest.Mock;
    findAll: jest.Mock;
    findByUserId: jest.Mock;
    findOne: jest.Mock;
    update: jest.Mock;
    remove: jest.Mock;
  };

  const mockPermissionId = new Types.ObjectId('650000000000000000000077').toString();
  const mockUserId = new Types.ObjectId('650000000000000000000088').toString();

  const mockPermissionDoc = {
    _id: mockPermissionId,
    userId: mockUserId,
    permissions: ['products.create', 'products.read_own'],
  };

  beforeEach(async () => {
    permissionsService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findByUserId: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PermissionsController],
      providers: [
        {
          provide: PermissionsService,
          useValue: permissionsService,
        },
        { provide: JwtService, useValue: {} },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: CACHE_MANAGER, useValue: { get: jest.fn(), set: jest.fn() } },
        { provide: Reflector, useValue: { getAllAndOverride: jest.fn() } },
      ],
    })
      .overrideGuard(AuthenticationGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PermissionsController>(PermissionsController);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('create', () => {
    it('should create permissions via service', async () => {
      const dto: CreatePermissionDto = {
        userId: mockUserId,
        permissions: ['products.create'],
      };
      permissionsService.create.mockResolvedValue(mockPermissionDoc);

      const result = await controller.create(dto);

      expect(permissionsService.create).toHaveBeenCalledWith(dto);
      expect(result).toEqual(mockPermissionDoc);
    });
  });

  describe('findAll', () => {
    it('should return all permissions', async () => {
      permissionsService.findAll.mockResolvedValue([mockPermissionDoc]);

      const result = await controller.findAll();

      expect(permissionsService.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockPermissionDoc]);
    });
  });

  describe('findByUserId', () => {
    it('should return permissions for specific user', async () => {
      permissionsService.findByUserId.mockResolvedValue(mockPermissionDoc);

      const result = await controller.findByUserId(mockUserId);

      expect(permissionsService.findByUserId).toHaveBeenCalledWith(mockUserId);
      expect(result).toEqual(mockPermissionDoc);
    });
  });

  describe('findOne', () => {
    it('should return permission record by id', async () => {
      permissionsService.findOne.mockResolvedValue(mockPermissionDoc);

      const result = await controller.findOne(mockPermissionId);

      expect(permissionsService.findOne).toHaveBeenCalledWith(mockPermissionId);
      expect(result).toEqual(mockPermissionDoc);
    });
  });

  describe('update', () => {
    it('should update permission record by id', async () => {
      const dto: UpdatePermissionDto = {
        permissions: ['products.create', 'products.delete'],
      };
      permissionsService.update.mockResolvedValue(mockPermissionDoc);

      const result = await controller.update(mockPermissionId, dto);

      expect(permissionsService.update).toHaveBeenCalledWith(
        mockPermissionId,
        dto,
      );
      expect(result).toEqual(mockPermissionDoc);
    });
  });

  describe('remove', () => {
    it('should remove permission record by id', async () => {
      const deleteResponse = { success: true, message: 'Deleted' };
      permissionsService.remove.mockResolvedValue(deleteResponse);

      const result = await controller.remove(mockPermissionId);

      expect(permissionsService.remove).toHaveBeenCalledWith(mockPermissionId);
      expect(result).toEqual(deleteResponse);
    });
  });
});
