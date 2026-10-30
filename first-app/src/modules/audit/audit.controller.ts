import { Controller, Get, Query, Param, UseGuards, HttpStatus } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@ApiTags('Audit Logs')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @permissions(Permission.AUDIT_LOG_READ)
  @Get('entity/:targetEntity')
  @ApiOperation({ summary: 'Get audit logs for a specific entity type' })
  @ApiParam({ name: 'targetEntity', description: 'Target entity name' })
  @ApiQuery({ name: 'targetId', required: false, description: 'Optional entity ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit logs retrieved' })
  public async getLogsByEntity(
    @Param('targetEntity') targetEntity: string,
    @Query('targetId') targetId?: string,
  ) {
    return this.auditService.getAuditLogsByEntity(targetEntity, targetId);
  }

  @permissions(Permission.AUDIT_LOG_READ)
  @Get('actor/:actorId')
  @ApiOperation({ summary: 'Get audit logs triggered by a specific actor' })
  @ApiParam({ name: 'actorId', description: 'Actor User ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Audit logs retrieved' })
  public async getLogsByActor(@Param('actorId') actorId: string) {
    return this.auditService.getAuditLogsByActor(actorId);
  }
}
