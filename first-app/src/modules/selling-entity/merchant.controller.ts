import {
  Controller,
  Get,
  Post,
  Body,
  Req,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpStatus,
  HttpCode,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { AllowPendingEntity } from '../../common/decorators/allow-pending-entity.decorator';
import { SellingEntityService } from './selling-entity.service';
import { Auditable } from '../../common/decorators/auditable.decorator';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';

@ApiTags('Merchant Onboarding & Status')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard)
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller(['merchant', 'api/merchant'])
export class MerchantController {
  constructor(private readonly sellingEntityService: SellingEntityService) {}

  @AllowPendingEntity()
  @permissions(Permission.SELLING_ENTITY_READ_OWN, Permission.PROFILE_READ_OWN)
  @Get('profile')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get merchant profile (accessible by pending entities)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Merchant profile returned' })
  async getProfile(@Req() req: any) {
    const ownerId = req.user?.sub || req.user?.id || req.user?._id;
    return this.sellingEntityService.getProfile(ownerId.toString());
  }

  @AllowPendingEntity()
  @permissions(Permission.SELLING_ENTITY_READ_OWN, Permission.PROFILE_READ_OWN)
  @Get('entity/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get merchant entity status (accessible by pending entities)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Merchant entity status returned' })
  async getEntityStatus(@Req() req: any) {
    const ownerId = req.user?.sub || req.user?.id || req.user?._id;
    return this.sellingEntityService.getEntityStatus(ownerId.toString());
  }

  @Auditable({
    targetEntity: 'SellingEntity',
    action: AuditActionEnum.UPDATE_ONBOARDING,
    targetIdExtractor: (req) => req.user?.sellingEntityId || req.user?.sub || req.user?.id,
  })
  @AllowPendingEntity()
  @permissions(Permission.SELLING_ENTITY_UPDATE_OWN, Permission.PROFILE_UPDATE_OWN)
  @Post('entity/documents')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit merchant onboarding verification documents' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Documents uploaded successfully' })
  async uploadDocuments(
    @Req() req: any,
    @Body() body: { documentUrl?: string; taxOrCommercialNumber?: string },
  ) {
    const ownerId = req.user?.sub || req.user?.id || req.user?._id;
    return this.sellingEntityService.uploadOnboardingDocuments(
      ownerId.toString(),
      body,
    );
  }
}

