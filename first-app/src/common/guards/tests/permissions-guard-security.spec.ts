import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Types } from 'mongoose';
import { PermissionsGuard } from '../permissions.guard';
import { evaluateSuperAdminStatus } from '../../utils/super-admin.policy';
import { Permission, DEFAULT_SUPER_ADMIN_PERMISSIONS } from '../../enums/permissions.enum';
import { RolesEnum } from '../../enums/roles';
import { AccountStatusEnum } from '../../enums/account-status';
import { PERMISSIONS_KEY } from '../../decorators/permissions.decorator';
import { IS_PUBLIC } from '../../decorators/public.decorator';
import { ALLOW_PENDING_ENTITY_KEY } from '../../decorators/allow-pending-entity.decorator';

describe('PermissionsGuard & Super Admin Policy — Security Regression Suite', () => {
  describe('evaluateSuperAdminStatus Policy', () => {
    it('rejects when userId is empty or invalid', async () => {
      const result = await evaluateSuperAdminStatus('');
      expect(result.isSuperAdmin).toBe(false);
      expect(result.userExists).toBe(false);
      expect(result.status).toBe('MISSING_ID');
    });

    it('rejects when user does not exist in database', async () => {
      const nonExistentId = new Types.ObjectId().toString();
      const result = await evaluateSuperAdminStatus(nonExistentId, undefined, null);
      expect(result.isSuperAdmin).toBe(false);
      expect(result.userExists).toBe(false);
      expect(result.status).toBe('NOT_FOUND');
    });

    it('rejects inactive or blocked user even if their role is super_admin', async () => {
      const blockedAdmin = {
        _id: new Types.ObjectId(),
        role: 'super_admin',
        status: AccountStatusEnum.BLOCKED,
        permissions: [Permission.PLATFORM_SUPER_ADMIN],
      };
      const result = await evaluateSuperAdminStatus(
        blockedAdmin._id.toString(),
        undefined,
        blockedAdmin,
      );
      expect(result.isSuperAdmin).toBe(false);
      expect(result.userExists).toBe(true);
      expect(result.isActive).toBe(false);
      expect(result.status).toBe('BLOCKED');
      expect(result.rejectionReason).toContain('Account is not active');
    });

    it('rejects suspended user', async () => {
      const suspendedAdmin = {
        _id: new Types.ObjectId(),
        role: 'super_admin',
        status: AccountStatusEnum.SUSPENDED,
      };
      const result = await evaluateSuperAdminStatus(
        suspendedAdmin._id.toString(),
        undefined,
        suspendedAdmin,
      );
      expect(result.isSuperAdmin).toBe(false);
      expect(result.isActive).toBe(false);
    });

    it('identifies Super Admin with role super_admin and active status', async () => {
      const superAdmin = {
        _id: new Types.ObjectId(),
        role: 'super_admin',
        status: AccountStatusEnum.ACTIVE,
      };
      const result = await evaluateSuperAdminStatus(
        superAdmin._id.toString(),
        undefined,
        superAdmin,
      );
      expect(result.isSuperAdmin).toBe(true);
      expect(result.isActive).toBe(true);
    });

    it('identifies Super Admin with role admin + platform.super_admin in User.permissions', async () => {
      const adminWithPerm = {
        _id: new Types.ObjectId(),
        role: RolesEnum.ADMIN,
        status: AccountStatusEnum.ACTIVE,
        permissions: [Permission.PLATFORM_SUPER_ADMIN, Permission.USER_MANAGE],
      };
      const result = await evaluateSuperAdminStatus(
        adminWithPerm._id.toString(),
        undefined,
        adminWithPerm,
        null,
      );
      expect(result.isSuperAdmin).toBe(true);
      expect(result.permissions).toContain(Permission.PLATFORM_SUPER_ADMIN);
    });

    it('identifies Super Admin with role admin + platform.super_admin in Permission document', async () => {
      const admin = {
        _id: new Types.ObjectId(),
        role: RolesEnum.ADMIN,
        status: AccountStatusEnum.ACTIVE,
        permissions: [],
      };
      const permDoc = {
        userId: admin._id,
        permissions: [Permission.PLATFORM_SUPER_ADMIN],
      };
      const result = await evaluateSuperAdminStatus(
        admin._id.toString(),
        undefined,
        admin,
        permDoc,
      );
      expect(result.isSuperAdmin).toBe(true);
      expect(result.permissions).toContain(Permission.PLATFORM_SUPER_ADMIN);
    });

    it('rejects ordinary admin without platform.super_admin', async () => {
      const regularAdmin = {
        _id: new Types.ObjectId(),
        role: RolesEnum.ADMIN,
        status: AccountStatusEnum.ACTIVE,
        permissions: [Permission.PROFILE_READ],
      };
      const result = await evaluateSuperAdminStatus(
        regularAdmin._id.toString(),
        undefined,
        regularAdmin,
      );
      expect(result.isSuperAdmin).toBe(false);
    });

    it('rejects customer with injected platform.super_admin in permissions', async () => {
      const customer = {
        _id: new Types.ObjectId(),
        role: RolesEnum.CUSTOMER,
        status: AccountStatusEnum.ACTIVE,
        permissions: [Permission.PLATFORM_SUPER_ADMIN],
      };
      const result = await evaluateSuperAdminStatus(
        customer._id.toString(),
        undefined,
        customer,
      );
      expect(result.isSuperAdmin).toBe(false);
    });
  });

  describe('PermissionsGuard Enforcement', () => {
    let reflector: Reflector;
    let guard: PermissionsGuard;
    let mockConnection: any;

    const mockUserModel = {
      findById: jest.fn(),
    };
    const mockPermModel = {
      findOne: jest.fn(),
    };
    const mockSellingEntityModel = {
      findOne: jest.fn(),
    };

    beforeEach(() => {
      reflector = new Reflector();
      mockConnection = {
        models: {
          User: mockUserModel,
          Permission: mockPermModel,
          SellingEntity: mockSellingEntityModel,
        },
      };
      guard = new PermissionsGuard(reflector, undefined, undefined, mockConnection);
      jest.clearAllMocks();
    });

    function createMockContext(
      user: any,
      requiredPermissions?: string[],
      allowPendingEntity = false,
    ): ExecutionContext {
      jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: any) => {
        if (key === PERMISSIONS_KEY) return requiredPermissions;
        if (key === IS_PUBLIC) return false;
        if (key === ALLOW_PENDING_ENTITY_KEY) return allowPendingEntity;
        return undefined;
      });
      const req: any = { user, headers: {} };
      return {
        switchToHttp: () => ({
          getRequest: () => req,
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as any;
    }

    it('fails closed when database connection is unavailable', async () => {
      const guardWithoutDb = new PermissionsGuard(reflector, undefined);
      const context = createMockContext(
        { id: new Types.ObjectId().toString(), role: 'super_admin' },
        [Permission.PLATFORM_SUPER_ADMIN],
      );
      await expect(guardWithoutDb.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('rejects unauthenticated request (no user in request)', async () => {
      const context = createMockContext(null, [Permission.PROFILE_READ]);
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('rejects user when user ID is not found in database', async () => {
      const unknownId = new Types.ObjectId().toString();
      mockUserModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const context = createMockContext(
        { id: unknownId, role: 'super_admin' },
        [Permission.PROFILE_READ],
      );
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it('blocks user with BLOCKED account status', async () => {
      const userId = new Types.ObjectId().toString();
      mockUserModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          role: 'super_admin',
          status: AccountStatusEnum.BLOCKED,
        }),
      });

      const context = createMockContext(
        { id: userId, role: 'super_admin' },
        [Permission.PLATFORM_SUPER_ADMIN],
      );
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('blocks user with SUSPENDED account status', async () => {
      const userId = new Types.ObjectId().toString();
      mockUserModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          role: 'super_admin',
          status: AccountStatusEnum.SUSPENDED,
        }),
      });

      const context = createMockContext(
        { id: userId, role: 'super_admin' },
        [Permission.PLATFORM_SUPER_ADMIN],
      );
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });

    it('ANTI-SPOOFING: Overwrites forged JWT super_admin role with database customer role and rejects', async () => {
      const userId = new Types.ObjectId().toString();
      mockUserModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          role: RolesEnum.CUSTOMER,
          status: AccountStatusEnum.ACTIVE,
          permissions: [],
        }),
      });
      mockPermModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      // Attacker claims in JWT: role: 'super_admin', permissions: ['platform.super_admin']
      const attackerJwtPayload = {
        id: userId,
        role: 'super_admin',
        permissions: [Permission.PLATFORM_SUPER_ADMIN],
      };

      const context = createMockContext(attackerJwtPayload, [Permission.PLATFORM_SUPER_ADMIN]);

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      // Verify JWT role was overwritten by DB role
      expect(attackerJwtPayload.role).toBe(RolesEnum.CUSTOMER.toLowerCase());
    });

    it('allows genuine Super Admin and grants default platform permissions', async () => {
      const userId = new Types.ObjectId().toString();
      mockUserModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(userId),
          role: RolesEnum.SUPER_ADMIN,
          status: AccountStatusEnum.ACTIVE,
          permissions: [],
        }),
      });
      mockPermModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });

      const superAdminUser = {
        id: userId,
        role: RolesEnum.SUPER_ADMIN,
        permissions: [],
      };

      const context = createMockContext(superAdminUser, [
        Permission.USER_MANAGE,
        Permission.PRODUCT_CREATE,
      ]);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
      expect(superAdminUser.permissions).toEqual(
        expect.arrayContaining(DEFAULT_SUPER_ADMIN_PERMISSIONS),
      );
    });

    it('PENDING SELLER: Blocks operational permissions for pending approval seller', async () => {
      const sellerId = new Types.ObjectId().toString();
      mockUserModel.findById.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(sellerId),
          role: RolesEnum.SELLER,
          status: AccountStatusEnum.ACTIVE,
        }),
      });
      mockPermModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue(null),
      });
      mockSellingEntityModel.findOne.mockReturnValue({
        lean: jest.fn().mockResolvedValue({
          _id: new Types.ObjectId(),
          primaryOwnerId: new Types.ObjectId(sellerId),
          status: 'PENDING_APPROVAL',
        }),
      });

      const sellerUser = {
        id: sellerId,
        role: RolesEnum.SELLER,
        entityStatus: 'PENDING_APPROVAL',
      };

      // Attempting operational product creation
      const context = createMockContext(sellerUser, ['product.create']);
      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
    });
  });
});
