import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Query,
  Req,
  UseGuards,
  UnauthorizedException,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Types } from 'mongoose';
import { CartService } from './cart.service';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';
import { AuthenticationGuard } from '../../common/guards/authentication.guard';
import { permissions } from '../../common/decorators/permissions.decorator';
import { Permission } from '../../common/enums/permission.enum';

@ApiTags('Cart')
@ApiBearerAuth('JWT-auth')
@Controller('cart')
@UseGuards(AuthenticationGuard)
@permissions(Permission.CART_MANAGE)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  private extractCustomerId(req: any): Types.ObjectId {
    const rawId = req.user?.id || req.user?._id || req.user?.sub;
    if (!rawId || !Types.ObjectId.isValid(rawId.toString())) {
      throw new UnauthorizedException('هوية المشتري غير صالحة أو غير مصرح بها');
    }
    return new Types.ObjectId(rawId.toString());
  }

  /**
   * GET /cart
   * استخراج هوية المشتري حصراً من الـ Token والاستعلام عن السلة بشرط: { customerId }
   */
  @Get()
  @ApiOperation({
    summary: 'Get customer shopping cart',
    description:
      'Extracts customer identity strictly from JWT token and returns user-specific cart ({ customerId })',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Cart retrieved successfully' })
  @ApiResponse({ status: HttpStatus.UNAUTHORIZED, description: 'Unauthorized or invalid token' })
  async getCart(@Req() req: any) {
    const customerId = this.extractCustomerId(req);
    return this.cartService.getCart(customerId);
  }

  /**
   * POST /cart/add
   * إضافة منتج إلى سلة المشتري حصراً
   */
  @Post('add')
  @ApiOperation({
    summary: 'Add product/variant to customer cart',
    description: 'Adds item to cart with stock validation and per-vendor line item breakdown',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item added to cart successfully' })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, description: 'Invalid product or insufficient stock' })
  async addToCart(@Req() req: any, @Body() dto: AddToCartDto) {
    const customerId = this.extractCustomerId(req);
    return this.cartService.addToCart(customerId, dto);
  }

  /**
   * PATCH /cart/item
   * تعديل كمية المنتج في السلة
   */
  @Patch('item')
  @ApiOperation({
    summary: 'Update item quantity in cart',
    description: 'Increments or decrements quantity for a specific SKU/variant',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item quantity updated successfully' })
  async updateItem(@Req() req: any, @Body() dto: UpdateCartItemDto) {
    const customerId = this.extractCustomerId(req);
    return this.cartService.updateItemQuantity(customerId, dto);
  }

  /**
   * DELETE /cart/item
   * حذف منتج محدد من السلة
   */
  @Delete('item')
  @ApiOperation({
    summary: 'Remove specific item from cart',
    description: 'Deletes an item or variant by productId and optional variantSku',
  })
  @ApiQuery({ name: 'productId', required: true, description: 'MongoDB ObjectId of the product' })
  @ApiQuery({ name: 'variantSku', required: false, description: 'SKU of the variant' })
  @ApiResponse({ status: HttpStatus.OK, description: 'Item removed from cart' })
  async removeItem(
    @Req() req: any,
    @Query('productId') productId: string,
    @Query('variantSku') variantSku: string,
  ) {
    const customerId = this.extractCustomerId(req);
    return this.cartService.removeItem(customerId, productId, variantSku);
  }

  /**
   * DELETE /cart
   * تفريغ السلة بالكامل
   */
  @Delete()
  @ApiOperation({
    summary: 'Clear entire shopping cart',
    description: 'Removes all items from the authenticated customer cart',
  })
  @ApiResponse({ status: HttpStatus.OK, description: 'Cart cleared successfully' })
  async clearCart(@Req() req: any) {
    const customerId = this.extractCustomerId(req);
    return this.cartService.clearCart(customerId);
  }
}
