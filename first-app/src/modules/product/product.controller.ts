import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductApprovalDto } from './dto/update-product-approval.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { PermissionEnum } from '../../common/enums/permissions.enum';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.PRODUCTS_CREATE)
  @Post()
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @Req() req: any,
    @Body('ownerId') ownerId?: string,
  ) {
    const userContext = req?.user || ownerId;
    return this.productService.createProduct(userContext, createProductDto);
  }

  @UseGuards(AuthenticationGuard)
  @Get()
  async findAll(
    @Query('approvalStatus') approvalStatus?: string,
    @Query('status') status?: string,
  ) {
    return this.productService.findAllForAdmin(approvalStatus || status);
  }

  @UseGuards(AuthenticationGuard)
  @Get('admin/pending')
  async findPending() {
    return this.productService.findAllForAdmin(
      ProductApprovalStatusEnum.PENDING_APPROVAL,
    );
  }

  @UseGuards(AuthenticationGuard)
  @Get('all')
  async getAllProducts() {
    return this.productService.findAllForAdmin();
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.PRODUCTS_APPROVE)
  @Patch([':id/approval', ':id/status'])
  @HttpCode(HttpStatus.OK)
  async updateApprovalStatus(
    @Param('id') id: string,
    @Body() updateApprovalDto: UpdateProductApprovalDto,
  ) {
    return this.productService.updateApprovalStatus(id, updateApprovalDto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.PRODUCTS_APPROVE)
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  async approveProduct(@Param('id') id: string) {
    return this.productService.updateApprovalStatus(id, {
      approvalStatus: ProductApprovalStatusEnum.APPROVED,
    });
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.PRODUCTS_APPROVE)
  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  async rejectProduct(
    @Param('id') id: string,
    @Body('rejectionReason') rejectionReason?: string,
  ) {
    return this.productService.updateApprovalStatus(id, {
      approvalStatus: ProductApprovalStatusEnum.REJECTED,
      rejectionReason: rejectionReason || 'المنتج غير مطابق للمواصفات المطلوبة',
    });
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.INVENTORY_MANAGE_OWN)
  @Patch('inventory/stock')
  @HttpCode(HttpStatus.OK)
  async updateInventoryStock(
    @Body() updateInventoryDto: UpdateInventoryDto,
    @Req() req: any,
    @Body('ownerId') ownerId?: string,
  ) {
    const userContext = req?.user?.sub || req?.user?.id || ownerId;
    return this.productService.updateInventoryStock(
      userContext,
      updateInventoryDto,
    );
  }

  @Post('inventory/reserve')
  @HttpCode(HttpStatus.OK)
  async reserveStockAtomic(
    @Body('sku') sku: string,
    @Body('quantity') quantity: number,
  ) {
    return this.productService.reserveStockAtomic(sku, quantity);
  }

  @Get('public')
  async findApprovedProducts(@Query('categoryId') categoryId?: string) {
    return this.productService.findApprovedProducts(categoryId);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.PRODUCTS_READ_OWN)
  @Get('entity/:sellingEntityId')
  async findEntityProducts(@Param('sellingEntityId') sellingEntityId: string) {
    return this.productService.findEntityProducts(sellingEntityId);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    return this.productService.findById(id);
  }
}
