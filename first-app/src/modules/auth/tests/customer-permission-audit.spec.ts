import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Types } from 'mongoose';
import { normalizePermissions } from '../../../common/utils/permission-normalizer.util';
import {
  Permission,
  DEFAULT_CUSTOMER_PERMISSIONS,
} from '../../../common/enums/permissions.enum';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { RolesEnum } from '../../../common/enums/roles';
import { AuthService } from '../auth.service';
import * as bcrypt from 'bcrypt';

describe('Customer Permission Duplication, Scope Overlaps, and Canonical Alignment Audit', () => {
  describe('Test 1: normalizePermissions() eliminates duplicates, removes orders.read, and outputs only canonical singular keys', () => {
    it('should eliminate plural duplicates, drop orders.read, and translate legacy keys to canonical singular enums', () => {
      const rawInput = [
        'orders.read', // broad leaked permission - must be dropped
        'order.read', // broad leaked permission - must be dropped
        'orders.read_own', // legacy plural - must map to order.read_own
        'order.read_own', // canonical singular - already present
        'orders.read_own', // duplicate entry
        'orders.create', // legacy plural - must map to order.create
        'order.create', // canonical singular - duplicate of above
        'orders.cancel_own', // legacy plural - must map to order.cancel_own
        'reviews.create', // legacy plural - must map to review.create
        'profile.manage', // legacy broad - must map to profile.update_own
        'profile.read', // legacy - must map to profile.read_own
        'product.read', // canonical
      ];

      const result = normalizePermissions(rawInput, RolesEnum.CUSTOMER);

      // 1. Array result assertions
      expect(Array.isArray(result)).toBe(true);

      // 2. Leaked broad permissions MUST be removed
      expect(result).not.toContain('orders.read');
      expect(result).not.toContain('order.read');
      expect(result).not.toContain('profile.manage');
      expect(result.droppedDangerousCount).toBeGreaterThanOrEqual(2);

      // 3. Plural keys MUST NOT be present
      expect(result).not.toContain('orders.read_own');
      expect(result).not.toContain('orders.create');
      expect(result).not.toContain('orders.cancel_own');
      expect(result).not.toContain('reviews.create');

      // 4. Canonical singular keys MUST be present and unique
      expect(result).toContain(Permission.ORDER_READ_OWN);
      expect(result).toContain(Permission.ORDER_CREATE);
      expect(result).toContain(Permission.ORDER_CANCEL_OWN);
      expect(result).toContain(Permission.REVIEW_CREATE);
      expect(result).toContain(Permission.PROFILE_READ_OWN);
      expect(result).toContain(Permission.PROFILE_UPDATE_OWN);
      expect(result).toContain(Permission.PRODUCT_READ);

      // 5. Verify no duplicates in the output
      const uniqueCount = new Set(result).size;
      expect(result.length).toBe(uniqueCount);

      // 6. Verify diagnostic metrics
      expect(result.migratedCount).toBeGreaterThan(0);
      expect(result.hasChanges).toBe(true);
      expect(result.permissions).toEqual([...result]);
    });
  });

  describe('Test 2: Decoded JWT payload contains an identical, deduplicated permission set matching the login response', () => {
    let authService: AuthService;
    let jwtService: JwtService;
    let mockUserRepo: any;
    let mockCustomerRepo: any;
    let mockSessionRepo: any;
    let mockPermissionRepo: any;
    let mockSellingEntityRepo: any;
    let mockMailService: any;
    let mockCacheManager: any;
    let mockConfigService: any;

    const mockUserId = new Types.ObjectId('650000000000000000000011');
    const mockHashedPassword = bcrypt.hashSync('Password123!', 10);

    beforeEach(() => {
      jwtService = new JwtService({ secret: 'test_jwt_secret_audit_123' });

      mockUserRepo = {
        getOne: jest.fn().mockResolvedValue({
          _id: mockUserId,
          userName: 'testcustomer',
          email: 'customer@example.com',
          password: mockHashedPassword,
          role: RolesEnum.CUSTOMER,
          status: 'ACTIVE',
          isEmailVerified: true,
        }),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      mockCustomerRepo = {
        create: jest.fn().mockResolvedValue({}),
      };

      mockSessionRepo = {
        create: jest.fn().mockResolvedValue({ _id: new Types.ObjectId() }),
        getAll: jest.fn().mockResolvedValue([]),
        updateOne: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
      };

      // Stored DB permissions contain legacy plural duplicates and broad orders.read
      mockPermissionRepo = {
        getOne: jest.fn().mockResolvedValue({
          userId: mockUserId.toString(),
          permissions: [
            'orders.read', // Leaked
            'orders.read_own', // Plural
            'order.read_own',
            'orders.create', // Plural
            'reviews.create', // Plural
            'profile.manage',
          ],
        }),
        upsertUserPermissions: jest.fn().mockResolvedValue(true),
      };

      mockSellingEntityRepo = {
        getOne: jest.fn().mockResolvedValue(null),
      };

      mockMailService = {
        send: jest.fn().mockResolvedValue(true),
      };

      mockCacheManager = {
        get: jest.fn().mockResolvedValue('1'),
        set: jest.fn().mockResolvedValue(true),
      };

      mockConfigService = {
        get: jest.fn((key: string) => {
          if (key === 'JWT_SECRET' || key === 'jwt.accessSecret') return 'test_jwt_secret_audit_123';
          return null;
        }),
      };

      authService = new AuthService(
        mockUserRepo,
        mockCustomerRepo,
        mockSessionRepo,
        jwtService,
        mockMailService,
        mockConfigService,
        mockPermissionRepo,
        mockSellingEntityRepo,
        mockCacheManager,
      );
    });

    it('should encode identical normalized permissions in JWT and response, and self-heal legacy DB documents', async () => {
      const loginResult = await authService.login({
        email: 'customer@example.com',
        password: 'Password123!',
      });

      const responsePermissions = loginResult.data.user.permissions;
      expect(Array.isArray(responsePermissions)).toBe(true);

      // Verify response permissions are clean
      expect(responsePermissions).not.toContain('orders.read');
      expect(responsePermissions).not.toContain('orders.read_own');
      expect(responsePermissions).not.toContain('orders.create');
      expect(responsePermissions).toContain(Permission.ORDER_READ_OWN);
      expect(responsePermissions).toContain(Permission.ORDER_CREATE);

      // Decode the JWT access token and inspect claims
      const decodedPayload: any = jwtService.decode(loginResult.data.accessToken);
      expect(decodedPayload).toBeDefined();
      expect(decodedPayload.role).toBe(RolesEnum.CUSTOMER);

      // JWT payload permissions must match the login response permissions exactly
      expect(decodedPayload.permissions).toEqual(responsePermissions);

      // Verify no duplicates exist in the JWT permissions
      const uniquePayloadPerms = new Set(decodedPayload.permissions).size;
      expect(decodedPayload.permissions.length).toBe(uniquePayloadPerms);

      // Verify self-healing DB update was called to clean up legacy document
      expect(mockPermissionRepo.upsertUserPermissions).toHaveBeenCalledWith(
        mockUserId.toString(),
        responsePermissions,
      );
    });
  });

  describe('Test 3: Unknown or unregistered permission strings are discarded', () => {
    it('should drop unknown, invalid, or malicious strings while keeping registered ones', () => {
      const dirtyInput = [
        'malicious.grant_super_admin',
        'arbitrary.unknown.permission',
        '   ',
        null as any,
        undefined as any,
        'inject_root_access',
        Permission.ORDER_CREATE,
        'order.read_own',
        'unknown_fake_perm_2026',
      ];

      const result = normalizePermissions(dirtyInput, RolesEnum.CUSTOMER);

      expect(result).not.toContain('malicious.grant_super_admin');
      expect(result).not.toContain('arbitrary.unknown.permission');
      expect(result).not.toContain('inject_root_access');
      expect(result).not.toContain('unknown_fake_perm_2026');

      expect(result).toContain(Permission.ORDER_CREATE);
      expect(result).toContain(Permission.ORDER_READ_OWN);
      expect(result.length).toBe(2);

      // 4 unknown strings + 3 invalid items (spaces/null/undefined)
      expect(result.droppedUnknownCount).toBeGreaterThanOrEqual(4);
    });
  });

  describe('Test 4: Customer cannot access endpoints guarded by order.read_all or payout.process', () => {
    let permissionsGuard: PermissionsGuard;
    let reflector: { getAllAndOverride: jest.Mock };

    beforeEach(() => {
      reflector = { getAllAndOverride: jest.fn() };
      permissionsGuard = new PermissionsGuard(
        reflector as unknown as Reflector,
        undefined,
        undefined,
        undefined,
      );
    });

    const createMockContext = (requiredPerm: Permission, userPerms: string[]): ExecutionContext => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [requiredPerm];
        return false;
      });

      return {
        switchToHttp: () => ({
          getRequest: () => ({
            user: {
              id: 'customer_999',
              role: RolesEnum.CUSTOMER,
              permissions: userPerms,
            },
          }),
          getResponse: () => ({}),
        }),
        getHandler: () => ({}),
        getClass: () => ({}),
      } as unknown as ExecutionContext;
    };

    it('should throw 403 Forbidden when customer attempts accessing an endpoint requiring order.read_all', async () => {
      const customerPerms = [...DEFAULT_CUSTOMER_PERMISSIONS];
      const context = createMockContext(Permission.ORDER_READ_ALL, customerPerms);

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        'Insufficient permissions',
      );
    });

    it('should throw 403 Forbidden when customer attempts accessing an endpoint requiring payout.process', async () => {
      const customerPerms = [...DEFAULT_CUSTOMER_PERMISSIONS];
      const context = createMockContext(Permission.PAYOUT_PROCESS, customerPerms);

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        'Insufficient permissions',
      );
    });

    it('should throw 403 Forbidden when customer attempts accessing an endpoint requiring product.approve', async () => {
      const customerPerms = [...DEFAULT_CUSTOMER_PERMISSIONS];
      const context = createMockContext(Permission.PRODUCT_APPROVE, customerPerms);

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw 403 Forbidden when customer attempts accessing an endpoint requiring refund.execute', async () => {
      const customerPerms = [...DEFAULT_CUSTOMER_PERMISSIONS];
      const context = createMockContext(Permission.REFUND_EXECUTE, customerPerms);

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow customer to access endpoints matching their own scoped permissions (order.read_own)', async () => {
      const customerPerms = [...DEFAULT_CUSTOMER_PERMISSIONS];
      const context = createMockContext(Permission.ORDER_READ_OWN, customerPerms);

      const canActivate = await permissionsGuard.canActivate(context);
      expect(canActivate).toBe(true);
    });
  });
});

