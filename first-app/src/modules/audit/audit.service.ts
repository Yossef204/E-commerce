import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Types } from 'mongoose';
import { AuditLogRepo } from '../../models/audit-log/audit-log.repository';
import { CreateAuditLogDto } from './dto/create-audit-log.dto';
import { AuditLogEvent } from '../../common/events/audit-log.event';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly auditLogRepo: AuditLogRepo) {}

  public async logAction(dto: CreateAuditLogDto) {
    this.logger.log(
      `AuditLog [${dto.action}] on ${dto.targetEntity}:${dto.targetId} by actor ${dto.actorId}`,
    );

    return this.auditLogRepo.create({
      actorId: new Types.ObjectId(dto.actorId),
      action: dto.action,
      targetEntity: dto.targetEntity,
      targetId: dto.targetId,
      previousState: dto.previousState,
      newState: dto.newState,
      ipAddress: dto.ipAddress,
    });
  }

  @OnEvent('audit.log', { async: true })
  public async handleAuditLogEvent(event: AuditLogEvent) {
    try {
      await this.logAction({
        actorId: event.actorId,
        action: event.action,
        targetEntity: event.targetEntity,
        targetId: event.targetId,
        previousState: event.previousState,
        newState: event.newState,
        ipAddress: event.ipAddress,
      });
    } catch (err) {
      this.logger.error('Failed to persist audit log event', err);
    }
  }

  public async getAuditLogsByEntity(targetEntity: string, targetId?: string) {
    const filter: any = { targetEntity };
    if (targetId) {
      filter.targetId = targetId;
    }
    return this.auditLogRepo.getAll(filter, undefined, {
      sort: { createdAt: -1 },
    });
  }

  public async getAuditLogsByActor(actorId: string) {
    return this.auditLogRepo.getAll(
      { actorId: new Types.ObjectId(actorId) },
      undefined,
      { sort: { createdAt: -1 } },
    );
  }
}
