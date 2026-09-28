import { Controller, Get, Query, Param } from '@nestjs/common';
import { AuditService } from './audit.service';

@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('entity/:targetEntity')
  public async getLogsByEntity(
    @Param('targetEntity') targetEntity: string,
    @Query('targetId') targetId?: string,
  ) {
    return this.auditService.getAuditLogsByEntity(targetEntity, targetId);
  }

  @Get('actor/:actorId')
  public async getLogsByActor(@Param('actorId') actorId: string) {
    return this.auditService.getAuditLogsByActor(actorId);
  }
}
