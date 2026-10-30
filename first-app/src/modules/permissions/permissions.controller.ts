import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PermissionsService } from './permissions.service';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { PermissionEnum } from '../../common/enums/permissions.enum';

@ApiTags('Permissions & User Management')
@ApiBearerAuth('JWT-auth')
@UseGuards(AuthenticationGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @permissions(PermissionEnum.USER_MANAGE)
  @Post()
  @ApiOperation({
    summary: 'Create custom permission rule',
    description: 'Defines a custom access control rule for user or role',
  })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Permission created' })
  create(@Body() createPermissionDto: CreatePermissionDto) {
    return this.permissionsService.create(createPermissionDto);
  }

  @permissions(PermissionEnum.USER_MANAGE)
  @Get()
  @ApiOperation({
    summary: 'Get all permission definitions',
    description: 'Lists all defined permissions across the system',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Permissions list' })
  findAll() {
    return this.permissionsService.findAll();
  }

  @permissions(PermissionEnum.USER_MANAGE)
  @Get('user/:userId')
  @ApiOperation({
    summary: 'Get user effective permission matrix',
    description: 'Calculates active permissions for a specific user ID based on role and custom grants',
  })
  @ApiParam({ name: 'userId', description: 'User MongoDB ObjectId' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Effective user permissions returned' })
  findByUserId(@Param('userId') userId: string) {
    return this.permissionsService.findByUserId(userId);
  }

  @permissions(PermissionEnum.USER_MANAGE)
  @Get(':id')
  @ApiOperation({ summary: 'Get permission rule by ID' })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Permission details' })
  findOne(@Param('id') id: string) {
    return this.permissionsService.findOne(id);
  }

  @permissions(PermissionEnum.USER_MANAGE)
  @Patch(':id')
  @ApiOperation({
    summary: 'Update employee permissions and revoke session',
    description: 'Updates granted permissions for an employee and increments tokenVersion to revoke active sessions',
  })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Permission updated successfully' })
  update(
    @Param('id') id: string,
    @Body() updatePermissionDto: UpdatePermissionDto,
  ) {
    return this.permissionsService.update(id, updatePermissionDto);
  }

  @permissions(PermissionEnum.USER_MANAGE)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete permission rule' })
  @ApiParam({ name: 'id', description: 'Permission ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Permission deleted' })
  remove(@Param('id') id: string) {
    return this.permissionsService.remove(id);
  }
}
