import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { RolesEnum } from '../enums/roles';
import { ROLES_KEY } from '../decorators/role.decorators';
import { IS_PUBLIC } from '../decorators/public.decorator';

describe('RolesGuard Unit Tests', () => {
  let guard: RolesGuard;
  let reflector: { getAllAndOverride: jest.Mock };

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() };
    guard = new RolesGuard(reflector as unknown as Reflector);
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

  it('should allow access if endpoint is marked public and has no roles', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC) return true;
      if (key === ROLES_KEY) return undefined;
      return undefined;
    });

    const context = createMockContext({});
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow access if no roles are required on endpoint', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC) return false;
      if (key === ROLES_KEY) return [];
      return undefined;
    });

    const context = createMockContext({});
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw 401 Unauthorized if user is missing on protected route', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC) return false;
      if (key === ROLES_KEY) return [RolesEnum.ADMIN];
      return undefined;
    });

    const context = createMockContext({ user: null });
    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should allow passage for Super Admin role automatically', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC) return false;
      if (key === ROLES_KEY) return [RolesEnum.ADMIN];
      return undefined;
    });

    const context = createMockContext({
      user: { role: RolesEnum.SUPER_ADMIN, isSuperAdmin: true },
    });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should allow passage if user has one of the required roles (case-insensitive)', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC) return false;
      if (key === ROLES_KEY) return [RolesEnum.ADMIN, RolesEnum.SELLER];
      return undefined;
    });

    const context = createMockContext({
      user: { role: 'Seller' },
    });
    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw 403 Forbidden if user lacks required role', async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === IS_PUBLIC) return false;
      if (key === ROLES_KEY) return [RolesEnum.ADMIN, RolesEnum.SUPER_ADMIN];
      return undefined;
    });

    const context = createMockContext({
      user: { role: RolesEnum.CUSTOMER },
    });
    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );
  });
});

