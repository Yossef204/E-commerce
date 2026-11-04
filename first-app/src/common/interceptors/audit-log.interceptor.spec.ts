import { ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, throwError } from 'rxjs';
import { AuditLogInterceptor } from './audit-log.interceptor';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditActionEnum } from '../enums/audit-action.enum';
import { AUDITABLE_KEY } from '../decorators/auditable.decorator';

describe('AuditLogInterceptor', () => {
  let interceptor: AuditLogInterceptor;
  let reflector: Reflector;
  let auditService: Partial<AuditService>;

  beforeEach(() => {
    reflector = new Reflector();
    auditService = {
      logAction: jest.fn().mockResolvedValue({} as any),
    };
    interceptor = new AuditLogInterceptor(reflector, auditService as AuditService);
  });

  const createMockContext = (req: any): ExecutionContext => ({
    getHandler: jest.fn(),
    getClass: jest.fn(),
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => ({}),
    }),
  } as unknown as ExecutionContext);

  it('should pass through without auditing if @Auditable metadata is not present', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

    const context = createMockContext({ user: { id: 'user123' }, body: {} });
    const next: CallHandler = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(context, next).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
        expect(auditService.logAction).not.toHaveBeenCalled();
        done();
      },
    });
  });

  it('should intercept, resolve targetId, sanitize state, and log action for decorated endpoint', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      targetEntity: 'Product',
      action: AuditActionEnum.CREATE,
    });

    const mockReq = {
      user: { id: '650000000000000000000001', role: 'seller' },
      body: { name: 'Wireless Headphones', price: 99, secret: 'vendor_internal_code' },
      ip: '192.168.1.100',
    };
    const context = createMockContext(mockReq);

    const responsePayload = {
      message: 'Created',
      data: {
        _id: '650000000000000000000002',
        name: 'Wireless Headphones',
        token: 'sensitive_jwt_token',
      },
    };
    const next: CallHandler = {
      handle: () => of(responsePayload),
    };

    interceptor.intercept(context, next).subscribe({
      next: (res) => {
        expect(res).toEqual(responsePayload);
        expect(auditService.logAction).toHaveBeenCalledWith({
          actorId: '650000000000000000000001',
          action: AuditActionEnum.CREATE,
          targetEntity: 'Product',
          targetId: '650000000000000000000002',
          previousState: {
            name: 'Wireless Headphones',
            price: 99,
            secret: '[REDACTED]',
          },
          newState: {
            _id: '650000000000000000000002',
            name: 'Wireless Headphones',
            token: '[REDACTED]',
          },
          ipAddress: '192.168.1.100',
        });
        done();
      },
    });
  });

  it('should sanitize nested sensitive fields like password and otp', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      targetEntity: 'User',
      action: AuditActionEnum.CHANGE_PASSWORD,
    });

    const mockReq = {
      user: { sub: '650000000000000000000003' },
      body: {
        currentPassword: 'oldPassword123!',
        newPassword: 'newSecurePassword456@',
        otp: '123456',
        nested: {
          secret: 'internal',
          normalField: 'visible',
        },
      },
      ip: '127.0.0.1',
    };
    const context = createMockContext(mockReq);
    const next: CallHandler = {
      handle: () => of({ success: true, message: 'Password changed' }),
    };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(auditService.logAction).toHaveBeenCalledWith(
          expect.objectContaining({
            actorId: '650000000000000000000003',
            action: AuditActionEnum.CHANGE_PASSWORD,
            targetEntity: 'User',
            previousState: {
              currentPassword: '[REDACTED]',
              newPassword: '[REDACTED]',
              otp: '[REDACTED]',
              nested: {
                secret: '[REDACTED]',
                normalField: 'visible',
              },
            },
          }),
        );
        done();
      },
    });
  });

  it('should not throw or disrupt the request when auditService.logAction fails', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      targetEntity: 'Brand',
      action: AuditActionEnum.DELETE,
    });
    (auditService.logAction as jest.Mock).mockRejectedValueOnce(
      new Error('Mongo Network Timeout'),
    );

    const mockReq = {
      user: { id: 'admin123' },
      params: { id: 'brand456' },
      body: {},
    };
    const context = createMockContext(mockReq);
    const next: CallHandler = {
      handle: () => of({ success: true }),
    };

    interceptor.intercept(context, next).subscribe({
      next: (val) => {
        expect(val).toEqual({ success: true });
        done();
      },
      error: () => {
        done.fail('Interceptor should not fail the HTTP request if audit logging fails');
      },
    });
  });

  it('should use custom targetIdExtractor when provided in options', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      targetEntity: 'Inventory',
      action: AuditActionEnum.STOCK_UPDATE,
      targetIdExtractor: (req) => req.body?.customSku,
    });

    const mockReq = {
      user: { id: 'seller001' },
      body: { customSku: 'SKU-SHOE-RED-42', quantity: 50 },
    };
    const context = createMockContext(mockReq);
    const next: CallHandler = {
      handle: () => of({ updated: true }),
    };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(auditService.logAction).toHaveBeenCalledWith(
          expect.objectContaining({
            targetEntity: 'Inventory',
            targetId: 'SKU-SHOE-RED-42',
            action: AuditActionEnum.STOCK_UPDATE,
          }),
        );
        done();
      },
    });
  });

  it('should handle circular references without throwing Maximum call stack size exceeded', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      targetEntity: 'Brand',
      action: AuditActionEnum.CREATE,
    });

    const circularObj: any = { name: 'Nike', token: 'secret-token' };
    circularObj.self = circularObj; // circular reference

    const mockReq = {
      user: { id: 'admin123' },
      body: circularObj,
      ip: '127.0.0.1',
    };
    const context = createMockContext(mockReq);

    const responsePayload: any = { success: true, data: { _id: 'brand999', name: 'Nike' } };
    responsePayload.data.loop = responsePayload; // circular reference in response

    const next: CallHandler = {
      handle: () => of(responsePayload),
    };

    expect(() => {
      interceptor.intercept(context, next).subscribe({
        next: (res) => {
          expect(res).toBeDefined();
          expect(auditService.logAction).toHaveBeenCalledWith(
            expect.objectContaining({
              targetEntity: 'Brand',
              targetId: 'brand999',
              action: AuditActionEnum.CREATE,
              previousState: expect.objectContaining({
                name: 'Nike',
                token: '[REDACTED]',
              }),
              newState: expect.objectContaining({
                _id: 'brand999',
                name: 'Nike',
              }),
            }),
          );
          done();
        },
      });
    }).not.toThrow();
  });

  it('should safely serialize Mongoose-like documents with .toObject() and internal properties', (done) => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
      targetEntity: 'Brand',
      action: AuditActionEnum.CREATE,
    });

    const fakeMongooseDoc = {
      _id: 'brand888',
      name: 'Adidas',
      password: 'brand_secret_pwd',
      $__: { activePaths: {} },
      _doc: { name: 'Adidas' },
      schema: { paths: {} },
      toObject: () => ({
        _id: 'brand888',
        name: 'Adidas',
        password: 'brand_secret_pwd',
        categories: ['cat1', 'cat2'],
      }),
    };

    const mockReq = {
      user: { id: 'admin123' },
      body: { name: 'Adidas' },
      ip: '127.0.0.1',
    };
    const context = createMockContext(mockReq);

    const next: CallHandler = {
      handle: () => of({ success: true, data: fakeMongooseDoc }),
    };

    interceptor.intercept(context, next).subscribe({
      next: () => {
        expect(auditService.logAction).toHaveBeenCalledWith(
          expect.objectContaining({
            targetEntity: 'Brand',
            targetId: 'brand888',
            newState: {
              _id: 'brand888',
              name: 'Adidas',
              password: '[REDACTED]',
              categories: ['cat1', 'cat2'],
            },
          }),
        );
        done();
      },
    });
  });
});

