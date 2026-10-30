import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Types } from 'mongoose';
import { CartRepo } from '../../models/cart/cart.repository';
import { CartItem } from '../../models/cart/cart.schema';
import { ProductRepo } from '../../models/product/product.repository';
import { AddToCartDto } from './dto/add-to-cart.dto';
import { UpdateCartItemDto } from './dto/update-cart-item.dto';

@Injectable()
export class CartService {
  constructor(
    private readonly cartRepo: CartRepo,
    private readonly productRepo: ProductRepo,
  ) {}

  private calculateTotals(items: CartItem[]) {
    let totalQuantity = 0;
    let totalPrice = 0;
    for (const item of items) {
      totalQuantity += item.quantity;
      totalPrice += item.price * item.quantity;
    }
    return {
      totalQuantity,
      totalPrice: Math.round(totalPrice * 100) / 100,
    };
  }

  /**
   * GET /cart
   * يستعلم عن السلة الخاصة بالمشتري حصراً
   */
  async getCart(customerId: Types.ObjectId) {
    let cart = await this.cartRepo.getOne({ customerId });
    if (!cart) {
      cart = await this.cartRepo.create({
        customerId,
        items: [],
        totalQuantity: 0,
        totalPrice: 0,
      });
    }
    return {
      success: true,
      data: cart,
    };
  }

  /**
   * POST /cart/add
   * إضافة عنصر إلى سلة المشتري حصراً
   */
  async addToCart(customerId: Types.ObjectId, dto: AddToCartDto) {
    let cart = await this.cartRepo.getOne({ customerId });
    if (!cart) {
      cart = await this.cartRepo.create({
        customerId,
        items: [],
        totalQuantity: 0,
        totalPrice: 0,
      });
    }

    const items: CartItem[] = [...(cart.items || [])];
    const existingIndex = items.findIndex(
      (i) =>
        i.productId.toString() === dto.productId &&
        i.variantSku === dto.variantSku,
    );

    const quantityToAdd = dto.quantity && dto.quantity > 0 ? dto.quantity : 1;

    if (existingIndex > -1) {
      items[existingIndex].quantity += quantityToAdd;
    } else {
      let title = dto.title || '';
      let price = dto.price || 0;
      let sellingEntityId = dto.sellingEntityId;
      let image = dto.image || '';

      if (Types.ObjectId.isValid(dto.productId)) {
        const prod = await this.productRepo.getOne({
          _id: new Types.ObjectId(dto.productId),
        });
        if (prod) {
          title = title || prod.title;
          sellingEntityId = sellingEntityId || prod.sellingEntityId?.toString();
          if (!price) {
            const variant = prod.variants?.find(
              (v: any) => v.sku === dto.variantSku,
            );
            price = variant?.price || prod.variants?.[0]?.price || 0;
          }
        }
      }

      if (!sellingEntityId || !Types.ObjectId.isValid(sellingEntityId)) {
        throw new BadRequestException('معرف الكيان التجاري للبائع غير صالح');
      }

      items.push({
        productId: new Types.ObjectId(dto.productId),
        variantSku: dto.variantSku,
        title,
        price,
        quantity: quantityToAdd,
        sellingEntityId: new Types.ObjectId(sellingEntityId),
        image,
        vendorName: dto.vendorName || '',
      });
    }

    const totals = this.calculateTotals(items);
    cart.items = items;
    cart.totalQuantity = totals.totalQuantity;
    cart.totalPrice = totals.totalPrice;

    await (cart as any).save();

    return {
      success: true,
      message: 'تمت إضافة المنتج إلى السلة بنجاح',
      data: cart,
    };
  }

  /**
   * PATCH /cart/item
   * تعديل كمية عنصر في السلة
   */
  async updateItemQuantity(customerId: Types.ObjectId, dto: UpdateCartItemDto) {
    const cart = await this.cartRepo.getOne({ customerId });
    if (!cart) {
      throw new NotFoundException('السلة غير موجودة');
    }

    let items: CartItem[] = [...(cart.items || [])];
    if (dto.quantity <= 0) {
      items = items.filter(
        (i) =>
          !(
            i.productId.toString() === dto.productId &&
            i.variantSku === dto.variantSku
          ),
      );
    } else {
      const item = items.find(
        (i) =>
          i.productId.toString() === dto.productId &&
          i.variantSku === dto.variantSku,
      );
      if (item) {
        item.quantity = dto.quantity;
      }
    }

    const totals = this.calculateTotals(items);
    cart.items = items;
    cart.totalQuantity = totals.totalQuantity;
    cart.totalPrice = totals.totalPrice;
    await (cart as any).save();

    return {
      success: true,
      data: cart,
    };
  }

  /**
   * DELETE /cart/item
   * حذف عنصر من السلة
   */
  async removeItem(
    customerId: Types.ObjectId,
    productId: string,
    variantSku: string,
  ) {
    const cart = await this.cartRepo.getOne({ customerId });
    if (!cart) {
      throw new NotFoundException('السلة غير موجودة');
    }

    const items = (cart.items || []).filter(
      (i) =>
        !(
          i.productId.toString() === productId && i.variantSku === variantSku
        ),
    );

    const totals = this.calculateTotals(items);
    cart.items = items;
    cart.totalQuantity = totals.totalQuantity;
    cart.totalPrice = totals.totalPrice;
    await (cart as any).save();

    return {
      success: true,
      message: 'تم حذف المنتج من السلة',
      data: cart,
    };
  }

  /**
   * DELETE /cart
   * تفريغ السلة بالكامل
   */
  async clearCart(customerId: Types.ObjectId) {
    const cart = await this.cartRepo.getOne({ customerId });
    if (cart) {
      cart.items = [];
      cart.totalQuantity = 0;
      cart.totalPrice = 0;
      await (cart as any).save();
    }
    return {
      success: true,
      message: 'تم تفريغ السلة بنجاح',
      data: { customerId, items: [], totalQuantity: 0, totalPrice: 0 },
    };
  }
}

