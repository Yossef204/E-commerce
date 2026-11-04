import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
  Optional,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AUDITABLE_KEY, AuditableOptions } from '../decorators/auditable.decorator';
import { AuditService } from '../../modules/audit/audit.service';
import { AuditActionEnum } from '../enums/audit-action.enum';

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditLogInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    @Optional() private readonly auditService?: AuditService,
    @Optional() private readonly eventEmitter?: EventEmitter2,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const auditable = this.reflector.getAllAndOverride<AuditableOptions>(
      AUDITABLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!auditable) {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest();
    if (!req) {
      return next.handle();
    }

    const actorId =
      req.user?.id ||
      req.user?.sub ||
      req.user?._id ||
      req.user?.userId ||
      '000000000000000000000000';

    const ipAddress =
      req.ip ||
      req.headers?.['x-forwarded-for'] ||
      req.socket?.remoteAddress ||
      '127.0.0.1';

    const previousState = this.sanitizeState(req.body);

    return next.handle().pipe(
      tap(async (resData) => {
        try {
          const targetId = this.resolveTargetId(auditable, req, resData, actorId);
          const newState = this.sanitizeState(resData?.data || resData);

          const action = (auditable.action as AuditActionEnum) || AuditActionEnum.UPDATE;
          const targetEntity = auditable.targetEntity;

          if (this.auditService) {
            await this.auditService.logAction({
              actorId: String(actorId),
              action,
              targetEntity,
              targetId: String(targetId),
              previousState,
              newState,
              ipAddress: String(ipAddress),
            });
          } else if (this.eventEmitter) {
            this.eventEmitter.emit('audit.log', {
              actorId: String(actorId),
              action,
              targetEntity,
              targetId: String(targetId),
              previousState,
              newState,
              ipAddress: String(ipAddress),
            });
          }
        } catch (err: any) {
          this.logger.warn(
            `Failed to record audit log for ${auditable.targetEntity}:${auditable.action} - ${err?.message}`,
          );
        }
      }),
    );
  }

  private resolveTargetId(
    options: AuditableOptions,
    req: any,
    resData: any,
    actorId: string,
  ): string {
    if (typeof options.targetIdExtractor === 'function') {
      try {
        const customId = options.targetIdExtractor(req, resData);
        if (customId) return String(customId);
      } catch {
        // fallback
      }
    }

    // 1. From request params
    if (req.params?.id) return String(req.params.id);
    if (req.params?.entityId) return String(req.params.entityId);
    if (req.params?.targetId) return String(req.params.targetId);
    if (req.params?.sellingEntityId) return String(req.params.sellingEntityId);

    // 2. From response data (crucial for CREATE operations)
    const entity = resData?.data || resData;
    if (entity?._id) return String(entity._id);
    if (entity?.id) return String(entity.id);
    if (Array.isArray(entity) && entity[0]?._id) return String(entity[0]._id);

    // 3. From request body
    if (req.body?._id) return String(req.body._id);
    if (req.body?.id) return String(req.body.id);
    if (req.body?.sellingEntityId) return String(req.body.sellingEntityId);

    // 4. Default fallback to authenticated actorId
    return String(actorId || 'N/A');
  }

  private sanitizeState(
    data: any,
    visited: WeakSet<object> = new WeakSet(),
  ): Record<string, any> | undefined {
    if (!data || typeof data !== 'object') return undefined;

    // Convert Mongoose Document or object with .toObject()/.toJSON() into plain JavaScript object
    let raw = data;
    if (typeof raw.toObject === 'function') {
      try {
        raw = raw.toObject({ depopulate: true });
      } catch {
        // Fallback if toObject fails
      }
    } else if (typeof raw.toJSON === 'function' && !(raw instanceof Date)) {
      try {
        raw = raw.toJSON();
      } catch {
        // Fallback if toJSON fails
      }
    }

    if (!raw || typeof raw !== 'object') return undefined;

    // Cycle detection using WeakSet
    if (visited.has(raw)) {
      return undefined;
    }
    visited.add(raw);

    const sensitiveKeys = new Set([
      'password',
      'currentpassword',
      'newpassword',
      'confirmpassword',
      'token',
      'refreshtoken',
      'accesstoken',
      'resettoken',
      'otp',
      'otphash',
      'emailverificationotphash',
      'secret',
    ]);

    const sanitizeValue = (val: any): any => {
      if (val === null || val === undefined) return val;
      if (typeof val !== 'object') return val;

      if (val instanceof Date) return val.toISOString();
      if (val._bsontype === 'ObjectID' || val.constructor?.name === 'ObjectId') {
        return val.toString();
      }

      if (Array.isArray(val)) {
        return val.map((item) => sanitizeValue(item));
      }

      return this.sanitizeState(val, visited);
    };

    const sanitized: Record<string, any> = {};
    for (const [key, value] of Object.entries(raw)) {
      // Omit Mongoose internal structures and schema properties
      if (key.startsWith('$') || key === '_doc' || key === 'schema') {
        continue;
      }

      if (sensitiveKeys.has(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeValue(value);
      }
    }
    return sanitized;
  }
}

