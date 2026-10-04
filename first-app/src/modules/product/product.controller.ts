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
} from '@nestjs/common';
import { ProductService } from './product.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductApprovalDto } from './dto/update-product-approval.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { PermissionEnum } from '../../common/enums/permissions.enum';

@UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.PRODUCTS_CREATE)
  @Post()
  async createProduct(
    @Body() createProductDto: CreateProductDto,
    @Body('ownerId') ownerId: string,
  ) {
    return this.productService.createProduct(ownerId, createProductDto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.PRODUCTS_APPROVE)
  @Patch(':id/approval')
  @HttpCode(HttpStatus.OK)
  async updateApprovalStatus(
    @Param('id') id: string,
    @Body() updateApprovalDto: UpdateProductApprovalDto,
  ) {
    return this.productService.updateApprovalStatus(id, updateApprovalDto);
  }

  @UseGuards(AuthenticationGuard)
  @permissions(PermissionEnum.INVENTORY_MANAGE_OWN)
  @Patch('inventory/stock')
  @HttpCode(HttpStatus.OK)
  async updateInventoryStock(
    @Body() updateInventoryDto: UpdateInventoryDto,
    @Body('ownerId') ownerId: string,
  ) {
    return this.productService.updateInventoryStock(
      ownerId,
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
}
