import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PermissionsGuard } from './permissions.guard';
import { AuthenticationGuard } from './authentication.guard';
import { Permission } from '../enums/permission.enum';
import { RolesEnum } from '../enums/roles';
import { IS_PUBLIC } from '../decorators/public.decorator';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

describe('RBAC & Security Guards Verification', () => {
  let permissionsGuard: PermissionsGuard;
  let authGuard: AuthenticationGuard;
  let reflector: { getAllAndOverride: jest.Mock };
  let jwtService: { verifyAsync: jest.Mock };
  let configService: { get: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    jwtService = { verifyAsync: jest.fn() };
    configService = { get: jest.fn().mockReturnValue('test_secret_key') };

    permissionsGuard = new PermissionsGuard(
      reflector as unknown as Reflector,
      jwtService as unknown as JwtService,
      configService as unknown as ConfigService,
    );

    authGuard = new AuthenticationGuard(
      jwtService as unknown as JwtService,
      reflector as unknown as Reflector,
      configService as unknown as ConfigService,
    );
  });

  const createMockContext = (req: any): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => ({}),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
  };

  describe('1. AuthenticationGuard: Token Validation & Tamper Protection', () => {
    it('should throw 401 Unauthorized when authorization token is missing', async () => {
      reflector.getAllAndOverride.mockReturnValue(false); // isPublic = false
      const context = createMockContext({ headers: {} });

      await expect(authGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw 401 Unauthorized when token signature is invalid or tampered', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      jwtService.verifyAsync.mockRejectedValue(new Error('invalid signature'));

      const context = createMockContext({
        headers: { authorization: 'Bearer invalid.tampered.token' },
      });

      await expect(authGuard.canActivate(context)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should inject req.user and pass when valid token is verified', async () => {
      reflector.getAllAndOverride.mockReturnValue(false);
      const validPayload = { id: 'user_123', email: 'test@example.com', role: RolesEnum.CUSTOMER };
      jwtService.verifyAsync.mockResolvedValue(validPayload);

      const req: any = { headers: { authorization: 'Bearer valid.jwt.token' } };
      const context = createMockContext(req);

      const result = await authGuard.canActivate(context);

      expect(result).toBe(true);
      expect(req.user).toEqual(expect.objectContaining(validPayload));
    });

    it('should allow public endpoints without token', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === IS_PUBLIC) return true;
        return false;
      });

      const context = createMockContext({ headers: {} });
      const result = await authGuard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('2. PermissionsGuard: Pending Seller Restriction', () => {
    it('should throw 403 Forbidden when a PENDING_APPROVAL seller attempts product creation', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [Permission.PRODUCT_CREATE];
        return false;
      });

      const req = {
        user: {
          id: 'seller_123',
          role: RolesEnum.SELLER,
          entityStatus: 'PENDING_APPROVAL',
          permissions: [Permission.PRODUCT_CREATE],
        },
      };
      const context = createMockContext(req);

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        'حساب التاجر قيد المراجعة والاعتماد من الإدارة',
      );
    });

    it('should throw 403 Forbidden when a PENDING_APPROVAL seller attempts payout request', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [Permission.PAYOUT_REQUEST];
        return false;
      });

      const req = {
        user: {
          id: 'seller_123',
          role: RolesEnum.SELLER,
          entityStatus: 'PENDING_APPROVAL',
          permissions: [Permission.PAYOUT_REQUEST],
        },
      };
      const context = createMockContext(req);

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow an APPROVED seller with required permissions to create products', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [Permission.PRODUCT_CREATE];
        return false;
      });

      const req = {
        user: {
          id: 'seller_123',
          role: RolesEnum.SELLER,
          entityStatus: 'APPROVED',
          permissions: [Permission.PRODUCT_CREATE],
        },
      };
      const context = createMockContext(req);

      const result = await permissionsGuard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('3. PermissionsGuard: Customer Privilege Isolation', () => {
    it('should throw 403 Forbidden when CUSTOMER attempts payout request', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [Permission.PAYOUT_REQUEST];
        return false;
      });

      const req = {
        user: {
          id: 'customer_123',
          role: RolesEnum.CUSTOMER,
          permissions: ['profile.read', 'order.create', 'order.read_own'],
        },
      };
      const context = createMockContext(req);

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        'Insufficient permissions',
      );
    });

    it('should throw 403 Forbidden when CUSTOMER attempts refund execution', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [Permission.REFUND_EXECUTE];
        return false;
      });

      const req = {
        user: {
          id: 'customer_123',
          role: RolesEnum.CUSTOMER,
          permissions: ['profile.read', 'order.create', 'order.read_own'],
        },
      };
      const context = createMockContext(req);

      await expect(permissionsGuard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow SUPER_ADMIN to perform any operation', async () => {
      reflector.getAllAndOverride.mockImplementation((key) => {
        if (key === PERMISSIONS_KEY) return [Permission.REFUND_EXECUTE, Permission.USER_MANAGE];
        return false;
      });

      const req = {
        user: {
          id: 'admin_123',
          role: RolesEnum.SUPER_ADMIN,
        },
      };
      const context = createMockContext(req);

      const result = await permissionsGuard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});

