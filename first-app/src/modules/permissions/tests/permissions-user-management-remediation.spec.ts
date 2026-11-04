import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import * as bcrypt from 'bcrypt';

import { PermissionsService } from '../permissions.service';
import { UserService } from '../../user/user.service';
import { CreatePermissionDto } from '../dto/create-permission.dto';
import { UpdatePermissionDto } from '../dto/update-permission.dto';
import { PermissionRepo } from '../../../models/permission/permission.repository';
import { UserRepo } from '../../../models/user/user.repository';
import { SessionRepo } from '../../../models/session/session.repository';
import { MainOrderRepo } from '../../../models/order/main-order.repository';
import { FileUploadsService } from '../../../shared/file-uploads/file-uploads.service';
import { CACHE_SERVICE } from '../../../shared/cache/interfaces/cache-service.interface';
import { Permission } from '../../../common/enums/permission.enum';
import { RolesEnum } from '../../../common/enums/roles';
import { AccountStatusEnum } from '../../../common/enums/account-status';
import { serializeSafeUser, serializeSafeUsers } from '../../../common/utils/safe-user.serializer';

describe('Permissions & User Management — Security Remediation Regression Suite', () => {
  let permissionsService: PermissionsService;
  let userService: UserService;

  // In-Memory Storage
  const inMemoryUsers = new Map<string, any>();
  const inMemoryPermissions = new Map<string, any>();
  const inMemorySessions = new Map<string, any>();
  const inMemoryCache = new Map<string, any>();

  // Mock IDs
  const superAdminId = new Types.ObjectId('650000000000000000000001');
  const employeeAdminId = new Types.ObjectId('650000000000000000000002');
  const companyAdminId = new Types.ObjectId('650000000000000000000003');
  const targetUserId = new Types.ObjectId('650000000000000000000004');
  const companyBUserId = new Types.ObjectId('650000000000000000000005');

  const entityA = new Types.ObjectId('650000000000000000000010');
  const entityB = new Types.ObjectId('650000000000000000000020');

  const initialHashedPassword = bcrypt.hashSync('CurrentPassword123!', 10);

  beforeEach(async () => {
    inMemoryUsers.clear();
    inMemoryPermissions.clear();
    inMemorySessions.clear();
    inMemoryCache.clear();

    // Populate Seed Mock Users
    inMemoryUsers.set(superAdminId.toString(), {
      _id: superAdminId,
      email: 'superadmin@marketplace.com',
      userName: 'Super Admin',
      role: RolesEnum.ADMIN,
      status: AccountStatusEnum.ACTIVE,
      isEmailVerified: true,
      tokenVersion: 1,
    });
    inMemoryPermissions.set(superAdminId.toString(), {
      _id: new Types.ObjectId(),
      userId: superAdminId,
      permissions: [Permission.PLATFORM_SUPER_ADMIN, Permission.USER_MANAGE],
    });

    inMemoryUsers.set(employeeAdminId.toString(), {
      _id: employeeAdminId,
      email: 'employee@marketplace.com',
      userName: 'Staff Employee',
      role: RolesEnum.ADMIN,
      status: AccountStatusEnum.ACTIVE,
      isEmailVerified: true,
      tokenVersion: 1,
    });
    inMemoryPermissions.set(employeeAdminId.toString(), {
      _id: new Types.ObjectId(),
      userId: employeeAdminId,
      permissions: [Permission.USER_MANAGE, Permission.PRODUCT_READ],
    });

    inMemoryUsers.set(companyAdminId.toString(), {
      _id: companyAdminId,
      email: 'companyadmin@brand.com',
      userName: 'Company Admin A',
      role: RolesEnum.COMPANY_ADMIN,
      sellingEntityId: entityA,
      status: AccountStatusEnum.ACTIVE,
      isEmailVerified: true,
      tokenVersion: 1,
    });

    inMemoryUsers.set(targetUserId.toString(), {
      _id: targetUserId,
      email: 'target@marketplace.com',
      userName: 'Target Customer',
      role: RolesEnum.CUSTOMER,
      sellingEntityId: entityA,
      status: AccountStatusEnum.ACTIVE,
      isEmailVerified: true,
      password: initialHashedPassword,
      tokenVersion: 1,
      emailVerificationOtpHash: 'secret_otp_hash_999',
    });

    inMemoryUsers.set(companyBUserId.toString(), {
      _id: companyBUserId,
      email: 'othercompany@vendor.com',
      userName: 'Vendor B User',
      role: RolesEnum.SELLER,
      sellingEntityId: entityB,
      status: AccountStatusEnum.ACTIVE,
      isEmailVerified: true,
      tokenVersion: 1,
    });

    // Mock Repositories
    const mockUserRepo = {
      getOne: jest.fn().mockImplementation((filter: any) => {
        const id = filter._id?.toString() || filter.id?.toString();
        const user = inMemoryUsers.get(id);
        return Promise.resolve(user ? { ...user } : null);
      }),
      getAll: jest.fn().mockImplementation(() => {
        return Promise.resolve(Array.from(inMemoryUsers.values()).map(u => ({ ...u })));
      }),
      updateOne: jest.fn().mockImplementation((filter: any, update: any) => {
        const id = filter._id?.toString();
        const user = inMemoryUsers.get(id);
        if (!user) return Promise.resolve(null);
        if (update.$inc?.tokenVersion) {
          user.tokenVersion = (user.tokenVersion || 1) + update.$inc.tokenVersion;
        }
        if (update.$set) {
          Object.assign(user, update.$set);
        }
        inMemoryUsers.set(id, user);
        return Promise.resolve({ ...user });
      }),
    };

    const mockPermissionRepo = {
      getOne: jest.fn().mockImplementation((filter: any) => {
        if (filter.userId) {
          const doc = inMemoryPermissions.get(filter.userId.toString());
          return Promise.resolve(doc ? { ...doc } : null);
        }
        if (filter._id) {
          for (const doc of inMemoryPermissions.values()) {
            if (doc._id.toString() === filter._id.toString()) {
              return Promise.resolve({ ...doc });
            }
          }
        }
        return Promise.resolve(null);
      }),
      upsertUserPermissions: jest.fn().mockImplementation((userId: string, perms: string[]) => {
        const existing = inMemoryPermissions.get(userId.toString()) || {
          _id: new Types.ObjectId(),
          userId: new Types.ObjectId(userId),
        };
        existing.permissions = perms;
        inMemoryPermissions.set(userId.toString(), existing);
        return Promise.resolve({ ...existing });
      }),
      updateOne: jest.fn().mockImplementation((filter: any, update: any) => {
        for (const [uid, doc] of inMemoryPermissions.entries()) {
          if (doc._id.toString() === filter._id.toString()) {
            if (update.$set) Object.assign(doc, update.$set);
            inMemoryPermissions.set(uid, doc);
            return Promise.resolve({ ...doc });
          }
        }
        return Promise.resolve(null);
      }),
      deleteOne: jest.fn().mockImplementation((filter: any) => {
        for (const [uid, doc] of inMemoryPermissions.entries()) {
          if (doc._id.toString() === filter._id.toString()) {
            inMemoryPermissions.delete(uid);
            return Promise.resolve({ ...doc });
          }
        }
        return Promise.resolve(null);
      }),
    };

    const mockSessionRepo = {
      updateMany: jest.fn().mockImplementation((filter: any, update: any) => {
        let count = 0;
        for (const [sid, sess] of inMemorySessions.entries()) {
          if (sess.userId.toString() === filter.userId?.toString()) {
            if (update.$set) Object.assign(sess, update.$set);
            inMemorySessions.set(sid, sess);
            count++;
          }
        }
        return Promise.resolve({ modifiedCount: count });
      }),
    };

    const mockCacheService = {
      get: jest.fn().mockImplementation((key: string) => {
        return Promise.resolve(inMemoryCache.get(key) || null);
      }),
      set: jest.fn().mockImplementation((key: string, val: any) => {
        inMemoryCache.set(key, val);
        return Promise.resolve();
      }),
      del: jest.fn().mockImplementation((key: string) => {
        inMemoryCache.delete(key);
        return Promise.resolve();
      }),
    };

    const mockOrderRepo = {
      getAll: jest.fn().mockResolvedValue([]),
    };

    const mockFileUploadsService = {
      deleteFile: jest.fn().mockResolvedValue(true),
    };

    const mockAuditService = {
      logAction: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PermissionsService,
        UserService,
        { provide: UserRepo, useValue: mockUserRepo },
        { provide: PermissionRepo, useValue: mockPermissionRepo },
        { provide: SessionRepo, useValue: mockSessionRepo },
        { provide: MainOrderRepo, useValue: mockOrderRepo },
        { provide: FileUploadsService, useValue: mockFileUploadsService },
        { provide: CACHE_SERVICE, useValue: mockCacheService },
        { provide: 'PERMISSIONS_AUDIT_SERVICE', useValue: mockAuditService },
      ],
    }).compile();

    permissionsService = module.get<PermissionsService>(PermissionsService);
    userService = module.get<UserService>(UserService);
  });

  // =========================================================================
  // 1. P0: PREVENT PRIVILEGE ESCALATION
  // =========================================================================
  describe('P0 — Privilege Escalation Prevention', () => {
    it('Employee with user.manage CANNOT grant platform.super_admin', async () => {
      const employeeCaller = { id: employeeAdminId.toString(), role: RolesEnum.ADMIN };
      const dto: CreatePermissionDto = {
        userId: targetUserId.toString(),
        permissions: [Permission.PLATFORM_SUPER_ADMIN],
      };

      await expect(
        permissionsService.create(dto, employeeCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Employee CANNOT grant permissions outside their authorized delegation scope', async () => {
      const employeeCaller = { id: employeeAdminId.toString(), role: RolesEnum.ADMIN };
      // Employee only has [USER_MANAGE, PRODUCT_READ]; attempting to grant CATEGORY_MANAGE
      const dto: CreatePermissionDto = {
        userId: targetUserId.toString(),
        permissions: [Permission.CATEGORY_MANAGE],
      };

      await expect(
        permissionsService.create(dto, employeeCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Employee CANNOT escalate or modify their own permissions (Self-Escalation)', async () => {
      const employeeCaller = { id: employeeAdminId.toString(), role: RolesEnum.ADMIN };
      const dto: CreatePermissionDto = {
        userId: employeeAdminId.toString(), // self
        permissions: [Permission.USER_MANAGE, Permission.PRODUCT_READ],
      };

      await expect(
        permissionsService.create(dto, employeeCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Non-super-admin CANNOT modify permissions of a Super Admin account', async () => {
      const employeeCaller = { id: employeeAdminId.toString(), role: RolesEnum.ADMIN };
      const dto: CreatePermissionDto = {
        userId: superAdminId.toString(),
        permissions: [Permission.USER_MANAGE],
      };

      await expect(
        permissionsService.create(dto, employeeCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Company Admin CANNOT modify users outside their company entity (Tenant Isolation)', async () => {
      const companyAdminCaller = { id: companyAdminId.toString(), role: RolesEnum.COMPANY_ADMIN };
      // Target belongs to Company B (entityB) while caller belongs to entityA
      const dto: CreatePermissionDto = {
        userId: companyBUserId.toString(),
        permissions: [Permission.PRODUCT_READ],
      };

      await expect(
        permissionsService.create(dto, companyAdminCaller),
      ).rejects.toThrow(ForbiddenException);
    });

    it('Verified Super Admin CAN grant explicitly allowed permissions', async () => {
      const superAdminCaller = { id: superAdminId.toString(), role: RolesEnum.ADMIN };
      const dto: CreatePermissionDto = {
        userId: targetUserId.toString(),
        permissions: [Permission.PRODUCT_READ, Permission.ORDER_READ_OWN],
      };

      const result = await permissionsService.create(dto, superAdminCaller);
      expect(result).toBeDefined();
      expect(result?.permissions).toContain(Permission.PRODUCT_READ);
    });
  });

  // =========================================================================
  // 2. P0: PREVENT PASSWORD HASH EXPOSURE
  // =========================================================================
  describe('P0 — Prevent Password Hash Exposure (Centralized Safe Serializer)', () => {
    it('serializeSafeUser strips password, OTP hashes, and auth secrets', () => {
      const rawDoc = {
        _id: new Types.ObjectId(),
        email: 'user@example.com',
        password: '$2b$10$UnsafeHashedPasswordString999',
        emailVerificationOtpHash: 'secret_otp_hash',
        emailVerificationOtpExpiresAt: new Date(),
        resetTokenHash: 'secret_reset_hash',
        profilePic: 'https://cdn.example.com/avatar.jpg',
        userName: 'Safe User',
      };

      const safe = serializeSafeUser(rawDoc);
      expect(safe.password).toBeUndefined();
      expect(safe.emailVerificationOtpHash).toBeUndefined();
      expect(safe.emailVerificationOtpExpiresAt).toBeUndefined();
      expect(safe.resetTokenHash).toBeUndefined();
      expect(safe.email).toBe('user@example.com');
      expect(safe.profilePic).toBe('https://cdn.example.com/avatar.jpg');
    });

    it('updateProfilePic returns safe user document without password hash', async () => {
      const avatarResult = await userService.updateProfilePic(
        targetUserId.toString(),
        'https://cdn.example.com/new-avatar.png',
      );

      expect(avatarResult).toBeDefined();
      expect(avatarResult.profilePic).toBe('https://cdn.example.com/new-avatar.png');
      expect((avatarResult as any).password).toBeUndefined();
      expect((avatarResult as any).emailVerificationOtpHash).toBeUndefined();
    });

    it('getProfile returns safe user document without password hash', async () => {
      const profileResult = await userService.getProfile(targetUserId.toString());
      expect(profileResult.success).toBe(true);
      expect(profileResult.user).toBeDefined();
      expect(profileResult.user.password).toBeUndefined();
      expect(profileResult.user.emailVerificationOtpHash).toBeUndefined();
    });

    it('getAllUsers returns safe user array without password hashes', async () => {
      const users = await userService.getAllUsers();
      expect(users.length).toBeGreaterThan(0);
      for (const u of users) {
        expect((u as any).password).toBeUndefined();
        expect((u as any).emailVerificationOtpHash).toBeUndefined();
      }
    });
  });

  // =========================================================================
  // 3. P0: PASSWORD CHANGE & SESSION REVOCATION
  // =========================================================================
  describe('P0 — Password Change & Session Invalidation', () => {
    it('Rejects incorrect current password without modifying database or sessions', async () => {
      await expect(
        userService.changePassword(targetUserId.toString(), {
          currentPassword: 'WrongPassword123!',
          newPassword: 'BrandNewPassword123!',
        }),
      ).rejects.toThrow(BadRequestException);

      const user = inMemoryUsers.get(targetUserId.toString());
      expect(user.tokenVersion).toBe(1);
    });

    it('Valid password change atomically increments tokenVersion in DB and Cache', async () => {
      // Setup existing active session
      inMemorySessions.set('session_1', {
        _id: new Types.ObjectId(),
        userId: targetUserId,
        isRevoked: false,
        activeTokenHash: 'hash_token_1',
      });

      const res = await userService.changePassword(targetUserId.toString(), {
        currentPassword: 'CurrentPassword123!',
        newPassword: 'BrandNewSecurePassword123!',
      });

      expect(res.success).toBe(true);

      // Verify DB tokenVersion incremented to 2
      const updatedUser = inMemoryUsers.get(targetUserId.toString());
      expect(updatedUser.tokenVersion).toBe(2);

      // Verify Canonical Redis Cache key populated with 2
      expect(inMemoryCache.get(`auth:token_version:${targetUserId.toString()}`)).toBe(2);

      // Verify Session marked isRevoked: true
      const sess = inMemorySessions.get('session_1');
      expect(sess.isRevoked).toBe(true);
      expect(sess.revocationReason).toBe('PASSWORD_CHANGED');
    });
  });

  // =========================================================================
  // 4. P1: DTO VALIDATION
  // =========================================================================
  describe('P1 — Permission DTO Validation', () => {
    it('Rejects empty DTO payload', async () => {
      const dto = plainToInstance(CreatePermissionDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
    });

    it('Rejects invalid MongoDB ObjectId format for userId', async () => {
      const dto = plainToInstance(CreatePermissionDto, {
        userId: 'not-a-mongo-id',
        permissions: [Permission.PRODUCT_READ],
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'userId')).toBe(true);
    });

    it('Rejects arbitrary non-canonical permission strings', async () => {
      const dto = plainToInstance(CreatePermissionDto, {
        userId: targetUserId.toString(),
        permissions: ['invalid_fake_permission_action'],
      });
      const errors = await validate(dto);
      expect(errors.some(e => e.property === 'permissions')).toBe(true);
    });

    it('Accepts valid canonical permission array with valid MongoId', async () => {
      const dto = plainToInstance(CreatePermissionDto, {
        userId: targetUserId.toString(),
        permissions: [Permission.PRODUCT_READ, Permission.ORDER_READ_OWN],
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });
  });

  // =========================================================================
  // 5. P1: OBJECTID VALIDATION
  // =========================================================================
  describe('P1 — Invalid MongoDB ObjectId Exception Handling', () => {
    it('findByUserId rejects malformed ID with BadRequestException (400)', async () => {
      await expect(permissionsService.findByUserId('malformed-bson-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('findOne rejects malformed ID with BadRequestException (400)', async () => {
      await expect(permissionsService.findOne('malformed-bson-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('update rejects malformed ID with BadRequestException (400)', async () => {
      await expect(permissionsService.update('malformed-bson-id', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('remove rejects malformed ID with BadRequestException (400)', async () => {
      await expect(permissionsService.remove('malformed-bson-id')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('Non-existent valid ObjectId returns NotFoundException (404), never 500', async () => {
      const nonExistentId = new Types.ObjectId('650000000000000000000999').toString();
      await expect(permissionsService.findOne(nonExistentId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});

