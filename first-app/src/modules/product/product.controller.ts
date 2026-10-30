import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
  HttpCode,
  HttpStatus,
  Req,
  ForbiddenException,
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { UpdateProductApprovalDto } from './dto/update-product-approval.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';
import { RolesEnum } from '../../common/enums/roles';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import { Public } from '../../common/decorators/public.decorator';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Products')
@ApiBearerAuth('JWT-auth')
@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PRODUCT_CREATE)
  @Post()
  @ApiOperation({ summary: 'Create new product draft (Vendor only)' })
  @ApiResponse({ status: HttpStatus.CREATED, description: 'Product draft created' })
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @Req() req: any,
    @Body('ownerId') ownerId?: string,
  ) {
    const userContext = req?.user || ownerId;
    return this.productService.createProduct(userContext, createProductDto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PRODUCT_READ)
  @Get()
  @ApiOperation({ summary: 'List all products with filter (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Products list' })
  async findAll(
    @Query('approvalStatus') approvalStatus?: string,
    @Query('status') status?: string,
  ) {
    return this.productService.findAllForAdmin(approvalStatus || status);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PRODUCT_APPROVE)
  @Get('admin/pending')
  @ApiOperation({ summary: 'List products pending approval (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Pending products list' })
  async findPending() {
    return this.productService.findAllForAdmin(
      ProductApprovalStatusEnum.PENDING_APPROVAL,
    );
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PRODUCT_READ)
  @Get('all')
  @ApiOperation({ summary: 'Get all platform products (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'All products returned' })
  async getAllProducts() {
    return this.productService.findAllForAdmin();
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PRODUCT_APPROVE)
  @Patch([':id/approval', ':id/status'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update product approval status (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product approval status updated' })
  async updateApprovalStatus(
    @Param('id') id: string,
    @Body() updateApprovalDto: UpdateProductApprovalDto,
  ) {
    return this.productService.updateApprovalStatus(id, updateApprovalDto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PRODUCT_APPROVE)
  @Patch(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve product (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product approved' })
  async approveProduct(@Param('id') id: string) {
    return this.productService.updateApprovalStatus(id, {
      approvalStatus: ProductApprovalStatusEnum.APPROVED,
    });
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PRODUCT_APPROVE)
  @Patch(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject product (Admin only)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product rejected' })
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
  @permissions(Permission.INVENTORY_UPDATE)
  @Patch('inventory/stock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update product inventory stock' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Inventory stock updated' })
  async updateInventoryStock(
    @Body() updateInventoryDto: UpdateInventoryDto,
    @Req() req: any,
    @Body('ownerId') ownerId?: string,
  ) {
    const userContext = req?.user || req?.user?.sub || req?.user?.id || ownerId;
    return this.productService.updateInventoryStock(
      userContext,
      updateInventoryDto,
    );
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.ORDER_CREATE)
  @Post('inventory/reserve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Atomic stock reservation for checkout order' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Stock reserved successfully' })
  async reserveStockAtomic(
    @Body('sku') sku: string,
    @Body('quantity') quantity: number,
  ) {
    return this.productService.reserveStockAtomic(sku, quantity);
  }

  @Public()
  @Get('public')
  @ApiOperation({ summary: 'Get approved products catalog for customers' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Approved products catalog' })
  async findApprovedProducts(@Query('categoryId') categoryId?: string) {
    return this.productService.findApprovedProducts(categoryId);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PRODUCT_READ)
  @Get('entity/:sellingEntityId')
  @ApiOperation({ summary: 'Get products belonging to selling entity' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Entity products returned' })
  async findEntityProducts(
    @Param('sellingEntityId') sellingEntityId: string,
    @Req() req?: any,
  ) {
    const user = req?.user;
    if (user) {
      const isSuperAdmin =
        user.role === RolesEnum.SUPER_ADMIN ||
        user.role === 'super_admin' ||
        user.role === 'admin';
      if (!isSuperAdmin && user.sellingEntityId && user.sellingEntityId.toString() !== sellingEntityId) {
        throw new ForbiddenException('غير مصرح لك باستعراض منتجات متجر آخر');
      }
    }
    return this.productService.findEntityProducts(sellingEntityId);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PRODUCT_UPDATE)
  @Patch(':id')
  @ApiOperation({ summary: 'Update product (Owner vendor or Admin)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product updated' })
  async updateProduct(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @Req() req: any,
  ) {
    const userContext = req?.user;
    return this.productService.updateProduct(id, updateProductDto, userContext);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(Permission.PRODUCT_DELETE)
  @Delete(':id')
  @ApiOperation({ summary: 'Delete product (Owner vendor or Admin)' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product deleted' })
  async deleteProduct(@Param('id') id: string, @Req() req: any) {
    const userContext = req?.user;
    return this.productService.deleteProduct(id, userContext);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Get product details by ID' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Product details' })
  async findById(@Param('id') id: string) {
    return this.productService.findById(id);
  }
}
