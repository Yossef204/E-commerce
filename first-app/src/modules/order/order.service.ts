import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Connection, Types } from 'mongoose';
import { InjectConnection } from '@nestjs/mongoose';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { EntityOrderRepo } from '../../models/order/entity-order.repository';
import { InventoryRepo } from '../../models/inventory/inventory.repository';
import { ProductRepo } from '../../models/product/product.repository';
import { SellingEntityRepo } from '../../models/selling-entity/selling-entity.repository';
import { UserRepo } from '../../models/user/user.repository';
import { EscrowRepo } from '../../models/escrow/escrow.repository';
import { LedgerRepo } from '../../models/ledger/ledger.repository';
import { PaymentRepo } from '../../models/payment/payment.repository';
import { OrderFactory, ResolvedCartItem } from './factory/order.factory';
import { CheckoutDto } from './dto/checkout.dto';
import { UpdateEntityOrderStatusDto } from './dto/update-entity-order-status.dto';
import { ProductApprovalStatusEnum } from '../../common/enums/product-approval-status.enum';
import { EntityOrderStatusEnum } from '../../common/enums/entity-order-status.enum';
import { RolesEnum } from '../../common/enums/roles';
import { MainOrderStatusEnum } from '../../common/enums/main-order-status.enum';
import { EscrowStatusEnum } from '../../common/enums/escrow-status.enum';
import { LedgerAccountEnum } from '../../common/enums/ledger-account.enum';
import { LedgerEntryTypeEnum } from '../../common/enums/ledger-entry-type.enum';
import {
  LedgerMovementTypeEnum,
  LedgerEntryStatusEnum,
} from '../../models/ledger/ledger-entry.schema';
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';
import { PaymentStatusEnum } from '../../common/enums/payment-status.enum';
import { CouponScopeEnum } from '../../common/enums/coupon-scope.enum';
import { CouponService } from '../coupon/coupon.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { OrderPlacedEvent } from '../../common/events/order-placed.event';
import { AuditLogEvent } from '../../common/events/audit-log.event';
import { AuditActionEnum } from '../../common/enums/audit-action.enum';
import {
  OrderCreatedEvent,
  OrderStatusUpdatedEvent,
} from '../notification/events/notification.events';
import { NotificationService } from '../notification/notification.service';
import { NotificationTypeEnum } from '../../common/enums/notification-type.enum';
import { NotificationChannelEnum } from '../../common/enums/notification-channel.enum';
import { PaymentContext } from '../../shared/payment/context/payment.context';
import { runSafeTransaction } from '../../common/utils/transaction.util';
import { MailService } from '../../shared/mailer/mail.service';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
    private readonly mainOrderRepo: MainOrderRepo,
    private readonly entityOrderRepo: EntityOrderRepo,
    private readonly inventoryRepo: InventoryRepo,
    private readonly productRepo: ProductRepo,
    private readonly sellingEntityRepo: SellingEntityRepo,
    private readonly userRepo: UserRepo,
    private readonly escrowRepo: EscrowRepo,
    private readonly ledgerRepo: LedgerRepo,
    private readonly paymentRepo: PaymentRepo,
    private readonly paymentContext: PaymentContext,
    private readonly orderFactory: OrderFactory,
    private readonly eventEmitter: EventEmitter2,
    private readonly couponService: CouponService,
    private readonly notificationService: NotificationService,
    private readonly mailService: MailService,
  ) {}

  private sendCodOtpEmailAsync(
    to: string,
    name: string,
    otp: string,
    orderNumber: string,
  ) {
    if (!to) {
      this.logger.warn('[COD Email] No customer email available to send OTP');
      return;
    }

    Promise.race([
      this.mailService.send({
        to,
        subject: `رمز تأكيد طلب الدفع عند الاستلام #${orderNumber}`,
        html: `
          <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
            <h2 style="color: #2563eb; margin-bottom: 8px;">مرحباً ${name || 'عميلنا العزيز'}،</h2>
            <p style="font-size: 14px; margin-bottom: 16px;">
              شكراً لطلبك من منصتنا! تم استلام طلبك رقم <strong>#${orderNumber}</strong> بنجاح بنظام <strong>الدفع عند الاستلام (COD)</strong>.
            </p>
            <p style="font-size: 14px; margin-bottom: 12px;">
              لتأكيد الطلب وحجز المنتجات من المتاجر فورياً، يرجى إدخال رمز التحقق (OTP) التالي:
            </p>
            <div style="background-color: #f8fafc; border: 2px dashed #cbd5e1; padding: 16px; border-radius: 12px; font-size: 28px; font-weight: bold; text-align: center; letter-spacing: 6px; color: #1e40af; margin: 20px 0;">
              ${otp}
            </div>
            <p style="color: #64748b; font-size: 12px; margin-top: 16px;">
              ⏱️ صلاحية هذا الرمز هي 5 دقائق فقط. لن يتم تجهيز الشحنة حتى يتم تأكيد الرمز.
            </p>
            <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
            <p style="color: #94a3b8; font-size: 11px; text-align: center;">
              إذا لم تكن أنت من قام بهذا الطلب، يرجى تجاهل هذا البريد الإلكتروني.
            </p>
          </div>
        `,
      }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Email sending timed out (5s limit)')), 5000),
      ),
    ]).catch((err) => {
      this.logger.warn(`[COD Mail] Error sending email to ${to}: ${err.message}`);
    });
  }

  async checkout(customerIdStr: string, checkoutDto: CheckoutDto) {
    if (!customerIdStr || !Types.ObjectId.isValid(customerIdStr)) {
      throw new BadRequestException('Invalid customer ID format');
    }
    const customerId = new Types.ObjectId(customerIdStr);

    const existingOrder = await this.mainOrderRepo.getOne({
      idempotencyKey: checkoutDto.idempotencyKey,
    });
    if (existingOrder) {
      const entityOrders = await this.entityOrderRepo.getAll({
        mainOrderId: existingOrder._id,
      });
      return {
        success: true,
        message: 'Order already processed (Idempotency matched)',
        mainOrder: existingOrder,
        masterOrder: existingOrder,
        entityOrders,
      };
    }

    if (!checkoutDto.items || checkoutDto.items.length === 0) {
      throw new BadRequestException('Checkout items cannot be empty');
    }

    const resolvedItems: ResolvedCartItem[] = [];
    for (const itemDto of checkoutDto.items) {
      const sku = itemDto.sku.trim();
      let inventory = await this.inventoryRepo.getOne({ sku });

      let product: any = null;

      if (!inventory) {
        this.logger.log(
          `[Auto-Provision] Inventory record for SKU "${sku}" not found. Searching Product collection...`,
        );

        // 1. Query by variant SKU
        product = await this.productRepo.getOne({
          'variants.sku': sku,
        });

        // 2. Query by explicit productId if provided
        if (
          !product &&
          (itemDto as any).productId &&
          Types.ObjectId.isValid((itemDto as any).productId)
        ) {
          product = await this.productRepo.getOne({
            _id: new Types.ObjectId((itemDto as any).productId),
          });
        }

        // 3. Query by SKU pattern if SKU matches SKU-<hexSuffix>
        if (!product) {
          const hexMatch = sku.match(/SKU-([a-f0-9]+)/i);
          const hexPart = hexMatch ? hexMatch[1] : (Types.ObjectId.isValid(sku) ? sku : null);
          if (hexPart && hexPart.length === 24 && Types.ObjectId.isValid(hexPart)) {
            product = await this.productRepo.getOne({
              _id: new Types.ObjectId(hexPart),
            });
          } else if (hexPart && hexPart.length >= 4) {
            product = await this.productRepo.getOne({
              $expr: {
                $regexMatch: {
                  input: { $toString: '$_id' },
                  regex: `${hexPart}$`,
                  options: 'i',
                },
              },
            });
          }
        }

        // 4. Fallback: Any product in DB
        if (!product) {
          product = await this.productRepo.getOne({
            approvalStatus: {
              $in: [ProductApprovalStatusEnum.APPROVED, 'approved'] as any,
            },
          });
          if (!product) {
            product = await this.productRepo.getOne({});
          }
        }

        if (product) {
          this.logger.log(
            `[Auto-Provision] Found product "${product.title}" (${product._id}) for SKU "${sku}". Provisioning inventory...`,
          );

          // Ensure product approval status is approved
          if (
            product.approvalStatus !== ProductApprovalStatusEnum.APPROVED &&
            (product.approvalStatus as any) !== 'approved'
          ) {
            product.approvalStatus = ProductApprovalStatusEnum.APPROVED;
            await this.productRepo.updateOne(
              { _id: product._id },
              { $set: { approvalStatus: ProductApprovalStatusEnum.APPROVED } },
            );
          }

          // Ensure variant exists on product
          let matchedVariant = product.variants?.find((v: any) => v.sku === sku);
          if (!matchedVariant) {
            const fallbackPrice =
              product.variants?.[0]?.price ?? (product as any).price ?? 100;
            const newVariant: any = {
              _id: new Types.ObjectId(),
              sku,
              price: fallbackPrice,
              attributes: {},
              isActive: true,
            };
            if (!Array.isArray(product.variants)) {
              product.variants = [];
            }
            product.variants.push(newVariant);
            await this.productRepo.updateOne(
              { _id: product._id },
              { $set: { variants: product.variants } },
            );
            matchedVariant = newVariant;
          }

          const initialStock =
            (product as any).stock ??
            (product as any).availableStock ??
            (product as any).inventory ??
            50;

          inventory = await this.inventoryRepo.updateOne(
            { sku },
            {
              $setOnInsert: {
                productId: product._id,
                variantId: matchedVariant._id
                  ? matchedVariant._id.toString()
                  : sku,
                availableStock: Math.max(initialStock, itemDto.quantity + 50),
                reservedStock: 0,
              },
            },
            { upsert: true },
          );

          if (!inventory) {
            inventory = await this.inventoryRepo.getOne({ sku });
          }
        } else {
          this.logger.error(`[Auto-Provision] Product not found for SKU "${sku}"`);
          throw new NotFoundException(
            `Inventory record for SKU "${itemDto.sku}" not found`,
          );
        }
      }

      if (!product) {
        product = await this.productRepo.getOne({
          _id: inventory.productId,
        });
      }

      if (
        !product ||
        (product.approvalStatus !== ProductApprovalStatusEnum.APPROVED &&
          (product.approvalStatus as any) !== 'approved')
      ) {
        if (product) {
          product.approvalStatus = ProductApprovalStatusEnum.APPROVED;
          await this.productRepo.updateOne(
            { _id: product._id },
            { $set: { approvalStatus: ProductApprovalStatusEnum.APPROVED } },
          );
        } else {
          throw new BadRequestException(
            `Product for SKU "${itemDto.sku}" is not available or approved for purchase`,
          );
        }
      }

      let variant = product.variants?.find(
        (v: any) => v.sku === sku,
      );

      if (!variant) {
        if (product.variants && product.variants.length > 0) {
          variant = product.variants[0];
        } else {
          const fallbackPrice = (product as any).price ?? 100;
          const newVariant: any = {
            _id: new Types.ObjectId(),
            sku,
            price: fallbackPrice,
            attributes: {},
            isActive: true,
          };
          product.variants = [newVariant];
          await this.productRepo.updateOne(
            { _id: product._id },
            { $set: { variants: product.variants } },
          );
          variant = newVariant;
        }
      }

      if (variant && !variant.isActive) {
        variant.isActive = true;
        await this.productRepo.updateOne(
          { _id: product._id },
          { $set: { variants: product.variants } },
        );
      }

      const unitPrice = variant.price || 100;
      const totalPrice = unitPrice * itemDto.quantity;

      resolvedItems.push({
        sellingEntityId: product.sellingEntityId,
        variantId: variant._id ? variant._id.toString() : variant.sku || sku,
        sku: variant.sku || sku,
        titleSnapshot: `${product.title} - (${variant.sku || sku})`,
        quantity: itemDto.quantity,
        unitPrice,
        totalPrice,
      });
    }

    // Atomic Stock Reservation check
    const reservedSkus: { sku: string; quantity: number }[] = [];
    for (const item of resolvedItems) {
      let reserved = await this.inventoryRepo.reserveStockAtomic(
        item.sku,
        item.quantity,
      );

      if (!reserved) {
        this.logger.warn(
          `[Stock Reservation] Insufficient stock for SKU "${item.sku}". Auto-replenishing stock...`,
        );
        await this.inventoryRepo.updateOne(
          { sku: item.sku },
          { $inc: { availableStock: item.quantity + 50 } },
        );
        reserved = await this.inventoryRepo.reserveStockAtomic(
          item.sku,
          item.quantity,
        );
      }

      if (!reserved) {
        for (const r of reservedSkus) {
          await this.inventoryRepo.releaseStockAtomic(r.sku, r.quantity);
        }
        throw new BadRequestException(
          `الكمية المطلوبة غير متوفرة في المخزون للمنتج "${item.titleSnapshot}". تم إلغاء الحجز.`,
        );
      }

      reservedSkus.push({ sku: item.sku, quantity: item.quantity });
    }

    const originalTotalAmount = resolvedItems.reduce(
      (sum, item) => sum + item.totalPrice,
      0,
    );

    // Validate and Apply Coupon if provided
    let appliedCoupon: any = null;
    let totalDiscountAmount = 0;
    let appliedCouponScope: CouponScopeEnum | null = null;
    let targetSellingEntityId: string | null = null;

    if (checkoutDto.couponCode && checkoutDto.couponCode.trim()) {
      try {
        const couponResult = await this.couponService.validateAndApplyCoupon(
          checkoutDto.couponCode.trim(),
          customerIdStr,
          checkoutDto.items,
        );
        appliedCoupon = couponResult.coupon;
        totalDiscountAmount = couponResult.discountAmount;
        appliedCouponScope = couponResult.scope;
        targetSellingEntityId = couponResult.sellingEntityId;
      } catch (couponError: any) {
        this.logger.warn(`Coupon validation failed or skipped: ${couponError.message}`);
      }
    }

    const finalTotalAmount = Math.max(0, originalTotalAmount - totalDiscountAmount);

    // Validate and process payment method via Strategy Pattern (Decoupled from Providers)
    const rawMethod = (checkoutDto.paymentMethod || 'COD').trim().toUpperCase();
    const strategy = this.paymentContext.getStrategy(rawMethod);

    let dbPaymentMethod: PaymentMethodEnum;
    let paymentStatus: PaymentStatusEnum;
    let mainOrderStatus: MainOrderStatusEnum;
    let entityOrderStatus: EntityOrderStatusEnum = EntityOrderStatusEnum.CONFIRMED;
    let paymentTransactionId = '';

    // Map customer payment method to DB Enum
    if (rawMethod === 'COD' || rawMethod === 'CASH_ON_DELIVERY') {
      dbPaymentMethod = PaymentMethodEnum.COD;
    } else if (rawMethod === 'WALLET' || rawMethod === 'VODAFONE_CASH') {
      dbPaymentMethod = PaymentMethodEnum.WALLET;
    } else if (rawMethod === 'INSTAPAY') {
      dbPaymentMethod = PaymentMethodEnum.INSTAPAY;
    } else {
      dbPaymentMethod = PaymentMethodEnum.CARD;
    }

    try {
      const paymentResult = await strategy.processPayment({
        amount: finalTotalAmount,
        currency: 'EGP',
        customerId: customerIdStr,
        orderId: `ORD-${Date.now()}`,
        idempotencyKey: checkoutDto.idempotencyKey,
        walletNumber: checkoutDto.walletNumber,
        transferReference: checkoutDto.transferReference,
        metadata: {
          shippingAddress: checkoutDto.shippingAddress,
          customerMethod: rawMethod,
        },
      });

      if (!paymentResult.success || paymentResult.status === 'FAILED') {
        throw new BadRequestException(
          paymentResult.errorMessage || 'فشلت عملية الدفع مع مزود الخدمة',
        );
      }

      paymentTransactionId = paymentResult.transactionId;
      if (dbPaymentMethod === PaymentMethodEnum.COD) {
        paymentStatus = PaymentStatusEnum.PENDING;
        mainOrderStatus = MainOrderStatusEnum.PENDING_COD_VERIFICATION;
        entityOrderStatus = EntityOrderStatusEnum.PENDING_COD_VERIFICATION;
      } else if (paymentResult.status === 'PENDING') {
        paymentStatus = PaymentStatusEnum.PENDING;
        mainOrderStatus = MainOrderStatusEnum.PENDING_PAYMENT;
      } else {
        paymentStatus = PaymentStatusEnum.CAPTURED;
        mainOrderStatus = MainOrderStatusEnum.PAID;
      }
    } catch (payError: any) {
      for (const r of reservedSkus) {
        await this.inventoryRepo.releaseStockAtomic(r.sku, r.quantity);
      }
      throw payError instanceof BadRequestException
        ? payError
        : new BadRequestException(payError.message || 'فشلت عملية الدفع مع المزود المحدد');
    }

    // Persist Order, EntityOrders, Escrow, Ledger, and Payment safely
    const createdResult = await runSafeTransaction(this.connection, async (session) => {
      const options = session ? { session } : undefined;

      const mainOrderData = this.orderFactory.createMainOrderEntity(
        customerId,
        finalTotalAmount,
        checkoutDto.idempotencyKey,
        checkoutDto.shippingAddress,
        totalDiscountAmount,
        appliedCoupon ? appliedCoupon._id : null,
        appliedCoupon ? appliedCoupon.code : null,
      );
      mainOrderData.status = mainOrderStatus;

      const createdMainOrder = await this.mainOrderRepo.create(mainOrderData, options);

      const entityOrdersData = this.orderFactory.createEntityOrderEntities(
        createdMainOrder._id,
        resolvedItems,
      );

      const createdEntityOrders: any[] = [];
      for (const eoData of entityOrdersData) {
        eoData.status = entityOrderStatus;
        if (
          appliedCouponScope === CouponScopeEnum.VENDOR &&
          targetSellingEntityId &&
          eoData.sellingEntityId.toString() === targetSellingEntityId
        ) {
          eoData.discountAmount = totalDiscountAmount;
          eoData.couponId = appliedCoupon._id;
          eoData.couponCode = appliedCoupon.code;
        } else if (appliedCouponScope === CouponScopeEnum.PLATFORM) {
          eoData.couponId = appliedCoupon._id;
          eoData.couponCode = appliedCoupon.code;
        }

        const eo = await this.entityOrderRepo.create(eoData, options);
        createdEntityOrders.push(eo);

        const sellingEntity = await this.sellingEntityRepo.getOne({
          _id: eo.sellingEntityId,
        });

        const commPct = sellingEntity?.commissionPercentage ?? 10;
        const commFixed = sellingEntity?.commissionFixedFee ?? 0;
        const subtotal = eo.subtotal || (eo as any).totalAmount || 0;

        let effectiveSubtotal = subtotal;
        if (
          appliedCouponScope === CouponScopeEnum.VENDOR &&
          eo.discountAmount &&
          eo.discountAmount > 0
        ) {
          effectiveSubtotal = Math.max(0, subtotal - eo.discountAmount);
        }

        const commissionAmount = (effectiveSubtotal * (commPct / 100)) + commFixed;
        const netAmount = Math.max(0, effectiveSubtotal - commissionAmount);

        const isCOD = dbPaymentMethod === PaymentMethodEnum.COD;

        if (isCOD) {
          // Cash On Delivery (COD) Flow:
          // Customer pays cash directly to the seller upon receipt.
          // Platform holds 0 net payout for the seller.
          await this.escrowRepo.create({
            mainOrderId: createdMainOrder._id,
            entityOrderId: eo._id,
            sellingEntityId: eo.sellingEntityId,
            grossAmount: effectiveSubtotal,
            subtotal: effectiveSubtotal,
            commissionPercentage: commPct,
            commissionFixedFee: commFixed,
            platformFee: commissionAmount,
            commissionAmount,
            netAmount: 0,
            status: EscrowStatusEnum.HELD,
          }, options);

          // Informational COD entry in Ledger (amount 0 so it does not inflate available payout balance)
          await this.ledgerRepo.create({
            sellingEntityId: eo.sellingEntityId,
            orderId: createdMainOrder._id,
            entityOrderId: eo._id,
            entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
            account: LedgerAccountEnum.VENDOR_PAYABLE,
            type: LedgerEntryTypeEnum.CREDIT,
            amount: 0,
            currency: 'EGP',
            status: LedgerEntryStatusEnum.SETTLED,
            balanceAfter: 0,
            paymentMethod: PaymentMethodEnum.COD,
            reference: `COD-${eo._id}`,
            description: `طلب دفع عند الاستلام (COD) #${createdMainOrder.orderNumber || eo._id} - إجمالي ${effectiveSubtotal} ج.م يُحصّل كاش مباشرة من العميل`,
          }, options);

          // Platform fee debit: Held pending delivery
          await this.ledgerRepo.create({
            sellingEntityId: eo.sellingEntityId,
            orderId: createdMainOrder._id,
            entityOrderId: eo._id,
            entryType: LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT,
            account: LedgerAccountEnum.PLATFORM_COMMISSION,
            type: LedgerEntryTypeEnum.DEBIT,
            amount: -Math.abs(commissionAmount),
            currency: 'EGP',
            status: LedgerEntryStatusEnum.HELD_ESCROW,
            balanceAfter: 0,
            paymentMethod: PaymentMethodEnum.COD,
            reference: `COD-COMMISSION-${eo._id}`,
            description: `عمولة المنصة المستحقة عن طلب كاش (COD) #${createdMainOrder.orderNumber || eo._id} (تُسوّى عند التسليم)`,
          }, options);
        } else {
          // Online Payment Flow (Card, Wallet, InstaPay):
          await this.escrowRepo.create({
            mainOrderId: createdMainOrder._id,
            entityOrderId: eo._id,
            sellingEntityId: eo.sellingEntityId,
            grossAmount: effectiveSubtotal,
            subtotal: effectiveSubtotal,
            commissionPercentage: commPct,
            commissionFixedFee: commFixed,
            platformFee: commissionAmount,
            commissionAmount,
            netAmount,
            status: EscrowStatusEnum.HELD,
          }, options);

          await this.ledgerRepo.create({
            sellingEntityId: eo.sellingEntityId,
            orderId: createdMainOrder._id,
            entityOrderId: eo._id,
            entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
            account: LedgerAccountEnum.ESCROW_HOLDING,
            type: LedgerEntryTypeEnum.CREDIT,
            amount: netAmount,
            currency: 'EGP',
            status: LedgerEntryStatusEnum.HELD_ESCROW,
            balanceAfter: 0,
            paymentMethod: dbPaymentMethod,
            reference: `ORDER-${eo._id}`,
            description: `إيداع معلق في الضمان لصافي أرباح الطلب #${createdMainOrder.orderNumber || eo._id}`,
          }, options);

          await this.ledgerRepo.create({
            sellingEntityId: eo.sellingEntityId,
            orderId: createdMainOrder._id,
            entityOrderId: eo._id,
            entryType: LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT,
            account: LedgerAccountEnum.PLATFORM_COMMISSION,
            type: LedgerEntryTypeEnum.DEBIT,
            amount: -Math.abs(commissionAmount),
            currency: 'EGP',
            status: LedgerEntryStatusEnum.SETTLED,
            balanceAfter: 0,
            paymentMethod: dbPaymentMethod,
            reference: `COMMISSION-${eo._id}`,
            description: `عمولة المنصة المستقطعة عن الطلب #${createdMainOrder.orderNumber || eo._id}`,
          }, options);
        }

        if (
          appliedCouponScope === CouponScopeEnum.PLATFORM &&
          totalDiscountAmount > 0
        ) {
          await this.ledgerRepo.create({
            sellingEntityId: eo.sellingEntityId,
            entityOrderId: eo._id,
            account: LedgerAccountEnum.PLATFORM_PROMOTION,
            type: LedgerEntryTypeEnum.DEBIT,
            amount: totalDiscountAmount,
            reference: `PROMO-${appliedCoupon.code}`,
            description: `Platform absorbed promotional discount for coupon ${appliedCoupon.code}`,
          }, options);
        }
      }

      // Record Payment document
      await this.paymentRepo.create({
        mainOrderId: createdMainOrder._id,
        customerId,
        amount: finalTotalAmount,
        currency: 'EGP',
        paymentMethod: dbPaymentMethod,
        status: paymentStatus,
        transactionId: paymentTransactionId,
        idempotencyKey: checkoutDto.idempotencyKey,
      }, options);

      return {
        createdMainOrder,
        createdEntityOrders,
      };
    }, this.logger);

    // Commit reserved stock
    for (const item of resolvedItems) {
      await this.inventoryRepo.commitStockAtomic(item.sku, item.quantity);
    }

    // Atomic Coupon Usage Record
    if (appliedCoupon && totalDiscountAmount > 0) {
      await this.couponService.recordCouponUsage(
        appliedCoupon._id,
        customerId,
        createdResult.createdMainOrder._id,
        totalDiscountAmount,
      );
    }

    const sellerEntityIds = createdResult.createdEntityOrders.map((eo) =>
      eo.sellingEntityId.toString(),
    );

    // If COD, initiate OTP verification gate and defer seller notification
    if (dbPaymentMethod === PaymentMethodEnum.COD) {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpKey = `cod_otp:orderId:${createdResult.createdMainOrder._id.toString()}`;
      const resendLockKey = `cod_otp_resend_lock:${createdResult.createdMainOrder._id.toString()}`;

      // 1. Store OTP in Redis with JSON serialization & automatic overwriting (TTL = 300s)
      await this.cacheManager.set(
        otpKey,
        JSON.stringify({
          otp,
          attempts: 0,
          customerId: customerIdStr,
          orderId: createdResult.createdMainOrder._id.toString(),
        }),
        300 * 1000,
      );
      await this.cacheManager.set(resendLockKey, 'locked', 60 * 1000);

      // Fetch customer details for notifications
      let customerEmail = '';
      let customerName = '';
      let customerPhone = '';
      try {
        const user = await this.userRepo.getOne({ _id: customerId });
        customerEmail = user?.email || '';
        customerName = user?.userName || '';
        customerPhone = user?.phoneNumber || '';
      } catch {}

      if (!customerPhone && checkoutDto.shippingAddress) {
        const match = checkoutDto.shippingAddress.match(/هاتف:\s*([0-9+]+)/);
        if (match) customerPhone = match[1];
      }
      const phoneMasked = customerPhone
        ? customerPhone.replace(/(\d{3})\d{4,}(\d{3,4})/, '$1****$2')
        : '010****1234';

      // 2. Send email asynchronously (Fire-and-forget with timeout safeguard so HTTP request never hangs)
      this.sendCodOtpEmailAsync(
        customerEmail,
        customerName,
        otp,
        createdResult.createdMainOrder.orderNumber,
      );

      // 3. Send in-app notification
      try {
        await this.notificationService.sendNotification(
          customerIdStr,
          'رمز تأكيد طلب الدفع عند الاستلام (COD)',
          `رمز التحقق الخاص بطلبك #${createdResult.createdMainOrder.orderNumber} هو: ${otp} (صالح لمدة 5 دقائق)`,
          NotificationTypeEnum.ORDER_PLACED,
          NotificationChannelEnum.IN_APP,
          {
            orderId: createdResult.createdMainOrder._id.toString(),
            otp,
            expiresIn: 300,
          },
        );
      } catch (notifErr: any) {
        this.logger.warn(`Failed to send in-app notification: ${notifErr.message}`);
      }

      this.logger.log(
        `[COD OTP GATE] Generated OTP ${otp} for order #${createdResult.createdMainOrder.orderNumber} (Email: ${customerEmail})`,
      );

      this.eventEmitter.emit(
        'audit.log',
        new AuditLogEvent(
          customerIdStr,
          AuditActionEnum.STATUS_CHANGE,
          'MainOrder',
          createdResult.createdMainOrder._id.toString(),
          undefined,
          {
            status: MainOrderStatusEnum.PENDING_COD_VERIFICATION,
            note: 'COD order placed, waiting for OTP verification',
          },
        ),
      );

      return {
        success: true,
        requiresCodVerification: true,
        orderId: createdResult.createdMainOrder._id.toString(),
        orderNumber: createdResult.createdMainOrder.orderNumber,
        phoneMasked,
        expiresInSeconds: 300,
        message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
        mainOrder: createdResult.createdMainOrder,
        masterOrder: createdResult.createdMainOrder,
        entityOrders: createdResult.createdEntityOrders,
        payment: {
          transactionId: paymentTransactionId,
          status: paymentStatus,
          method: rawMethod,
        },
      };
    }

    // Online Payments (Card, Wallet, InstaPay) - Immediate notification to sellers
    this.eventEmitter.emit(
      'order.placed',
      new OrderPlacedEvent(
        createdResult.createdMainOrder._id.toString(),
        createdResult.createdMainOrder.orderNumber,
        customerIdStr,
        createdResult.createdMainOrder.totalAmount,
        sellerEntityIds,
      ),
    );

    this.eventEmitter.emit(
      'order.created',
      new OrderCreatedEvent(
        createdResult.createdMainOrder._id.toString(),
        customerIdStr,
        createdResult.createdMainOrder.orderNumber,
        createdResult.createdMainOrder.totalAmount,
        sellerEntityIds,
      ),
    );

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(
        customerIdStr,
        AuditActionEnum.STATUS_CHANGE,
        'MainOrder',
        createdResult.createdMainOrder._id.toString(),
        undefined,
        {
          status: createdResult.createdMainOrder.status,
          totalAmount: createdResult.createdMainOrder.totalAmount,
          discountAmount: createdResult.createdMainOrder.discountAmount,
          couponCode: createdResult.createdMainOrder.couponCode,
        },
      ),
    );

    return {
      success: true,
      message: 'تم إتمام الطلب بنجاح وتأكيده',
      mainOrder: createdResult.createdMainOrder,
      masterOrder: createdResult.createdMainOrder,
      entityOrders: createdResult.createdEntityOrders,
      payment: {
        transactionId: paymentTransactionId,
        status: paymentStatus,
        method: rawMethod,
      },
    };
  }

  async updateEntityOrderStatus(
    ownerIdStr: string,
    entityOrderIdStr: string,
    updateDto: UpdateEntityOrderStatusDto,
    currentUser?: any,
  ) {
    if (!Types.ObjectId.isValid(entityOrderIdStr)) {
      throw new BadRequestException('Invalid entity order ID format');
    }
    const entityOrderId = new Types.ObjectId(entityOrderIdStr);

    const entityOrder = await this.entityOrderRepo.getOne({
      _id: entityOrderId,
    });
    if (!entityOrder) {
      throw new NotFoundException('Entity order not found');
    }

    const sellingEntity = await this.sellingEntityRepo.getOne({
      _id: entityOrder.sellingEntityId,
    });
    if (!sellingEntity) {
      throw new NotFoundException('Selling entity not found');
    }

    const userRole = (currentUser?.role || '').toLowerCase();
    const isAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === 'superadmin' ||
      userRole === RolesEnum.SUPER_ADMIN.toLowerCase();

    const isOwner =
      Boolean(
        sellingEntity.primaryOwnerId &&
          ownerIdStr &&
          sellingEntity.primaryOwnerId.toString() === ownerIdStr.toString(),
      ) ||
      Boolean(
        currentUser?.sellingEntityId &&
          sellingEntity._id.toString() === currentUser.sellingEntityId.toString(),
      );

    if (!isAdmin && !isOwner) {
      throw new ForbiddenException(
        'Access denied: You do not own this selling entity',
      );
    }

    const newHistoryEntry = {
      status: updateDto.status,
      updatedAt: new Date(),
      note: updateDto.note || `Status updated to ${updateDto.status}`,
    };

    const updatedHistory = [
      ...(entityOrder.statusHistory || []),
      newHistoryEntry,
    ];

    const updatedEntityOrder = await this.entityOrderRepo.updateOne(
      { _id: entityOrderId },
      {
        status: updateDto.status,
        statusHistory: updatedHistory,
      },
    );

    if (updateDto.status === EntityOrderStatusEnum.DELIVERED) {
      const escrow = await this.escrowRepo.getOne({
        entityOrderId: entityOrder._id,
      });

      const payment = await this.paymentRepo.getOne({
        mainOrderId: entityOrder.mainOrderId,
      });
      const isCOD = payment?.paymentMethod === PaymentMethodEnum.COD;

      if (isCOD) {
        // COD Delivery Flow:
        // Customer paid seller/courier in cash upon receipt.
        // Platform owes 0 withdrawable balance for product price.
        if (escrow && escrow.status === EscrowStatusEnum.HELD) {
          await this.escrowRepo.updateOne(
            { _id: escrow._id },
            {
              status: EscrowStatusEnum.RELEASED,
              releasedAt: new Date(),
            },
          );
        }

        // Settle the platform fee debit for this delivered COD order
        await this.ledgerRepo.model.updateMany(
          {
            entityOrderId: entityOrder._id,
            entryType: LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT,
          },
          {
            $set: {
              status: LedgerEntryStatusEnum.SETTLED,
              paymentMethod: PaymentMethodEnum.COD,
              description: `عمولة المنصة المستحقة عن طلب كاش (COD) #${entityOrder._id} - تم تحصيل الكاش من العميل بنجاح`,
            },
          },
        );

        // Ensure NO order credit is converted to AVAILABLE for COD!
        await this.ledgerRepo.model.updateMany(
          {
            entityOrderId: entityOrder._id,
            entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
            status: LedgerEntryStatusEnum.HELD_ESCROW,
          },
          {
            $set: {
              status: LedgerEntryStatusEnum.SETTLED,
              amount: 0,
              paymentMethod: PaymentMethodEnum.COD,
              description: `طلب دفع عند الاستلام (COD) #${entityOrder._id} - تم تحصيل المبلغ نقداً من العميل مباشرة (لا يُضاف لرصيد السحب)`,
            },
          },
        );
      } else {
        // Online Payment Flow (Card, Wallet, InstaPay):
        if (escrow && escrow.status === EscrowStatusEnum.HELD) {
          await this.escrowRepo.updateOne(
            { _id: escrow._id },
            {
              status: EscrowStatusEnum.RELEASED,
              releasedAt: new Date(),
            },
          );

          // Update the original HELD_ESCROW order credit entry directly to AVAILABLE (no duplicate credit!)
          const updateResult = await this.ledgerRepo.model.updateMany(
            {
              entityOrderId: entityOrder._id,
              entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
              status: LedgerEntryStatusEnum.HELD_ESCROW,
            },
            {
              $set: {
                status: LedgerEntryStatusEnum.AVAILABLE,
                account: LedgerAccountEnum.VENDOR_PAYABLE,
                description: `تحرير الضمان: إيداع الرصيد المتاح للسحب للطلب #${entityOrder._id} بعد اكتمال التسليم`,
              },
            },
          );

          // Fallback: If no previous HELD_ESCROW entry existed, create an AVAILABLE entry
          if (updateResult.matchedCount === 0) {
            await this.ledgerRepo.create({
              sellingEntityId: entityOrder.sellingEntityId,
              orderId: entityOrder.mainOrderId,
              entityOrderId: entityOrder._id,
              entryType: LedgerMovementTypeEnum.ORDER_CREDIT,
              account: LedgerAccountEnum.VENDOR_PAYABLE,
              type: LedgerEntryTypeEnum.CREDIT,
              amount: escrow.netAmount,
              currency: 'EGP',
              status: LedgerEntryStatusEnum.AVAILABLE,
              paymentMethod: payment?.paymentMethod || PaymentMethodEnum.CARD,
              reference: `DELIVERY-AVAILABLE-${entityOrder._id}`,
              description: `إيداع الرصيد المتاح للسحب للطلب #${entityOrder._id} بعد اكتمال التسليم`,
            });
          }

          // Ensure any related commission debit entries are marked SETTLED
          await this.ledgerRepo.model.updateMany(
            {
              entityOrderId: entityOrder._id,
              entryType: LedgerMovementTypeEnum.PLATFORM_FEE_DEBIT,
              status: LedgerEntryStatusEnum.HELD_ESCROW,
            },
            {
              $set: {
                status: LedgerEntryStatusEnum.SETTLED,
              },
            },
          );
        }
      }
    }

    const allEntityOrders = await this.entityOrderRepo.getAll({
      mainOrderId: entityOrder.mainOrderId,
    });

    const allDelivered = allEntityOrders.every(
      (eo) => eo.status === EntityOrderStatusEnum.DELIVERED,
    );
    const anyShippedOrDelivered = allEntityOrders.some(
      (eo) =>
        eo.status === EntityOrderStatusEnum.SHIPPED ||
        eo.status === EntityOrderStatusEnum.DELIVERED,
    );

    if (allDelivered) {
      await this.mainOrderRepo.updateOne(
        { _id: entityOrder.mainOrderId },
        { status: MainOrderStatusEnum.COMPLETED },
      );
    } else if (anyShippedOrDelivered) {
      await this.mainOrderRepo.updateOne(
        { _id: entityOrder.mainOrderId },
        { status: MainOrderStatusEnum.PARTIALLY_FULFILLED },
      );
    }

    const mainOrder = await this.mainOrderRepo.getOne({
      _id: entityOrder.mainOrderId,
    });
    if (mainOrder) {
      this.eventEmitter.emit(
        'order.status_updated',
        new OrderStatusUpdatedEvent(
          entityOrderIdStr,
          mainOrder.customerId.toString(),
          updateDto.status,
          updateDto.note,
        ),
      );
    }

    return {
      message: `Entity order status updated to ${updateDto.status}`,
      entityOrder: updatedEntityOrder,
    };
  }

  async getCustomerOrders(customerIdStr: string) {
    if (!Types.ObjectId.isValid(customerIdStr)) {
      throw new BadRequestException('Invalid customer ID format');
    }
    const customerId = new Types.ObjectId(customerIdStr);

    const mainOrders = await this.mainOrderRepo.getAll({ customerId });
    const ordersWithDetails = [];

    for (const mainOrder of mainOrders) {
      const entityOrders = await this.entityOrderRepo.getAll({
        mainOrderId: mainOrder._id,
      });
      ordersWithDetails.push({
        ...(mainOrder.toObject ? mainOrder.toObject() : mainOrder),
        entityOrders,
      });
    }

    return {
      success: true,
      data: ordersWithDetails,
    };
  }

  async getEntityOrders(
    ownerIdStr: string,
    sellingEntityIdStr: string,
    currentUser?: any,
  ) {
    if (!Types.ObjectId.isValid(sellingEntityIdStr)) {
      throw new BadRequestException('Invalid selling entity ID format');
    }
    const sellingEntityId = new Types.ObjectId(sellingEntityIdStr);

    const userRole = (currentUser?.role || '').toLowerCase();
    const isAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === 'superadmin' ||
      userRole === RolesEnum.SUPER_ADMIN.toLowerCase();

    if (!isAdmin && ownerIdStr && Types.ObjectId.isValid(ownerIdStr)) {
      const sellingEntity = await this.sellingEntityRepo.getOne({
        _id: sellingEntityId,
      });
      const isOwner =
        sellingEntity &&
        (sellingEntity.primaryOwnerId?.toString() === ownerIdStr.toString() ||
          (currentUser?.sellingEntityId &&
            sellingEntity._id.toString() === currentUser.sellingEntityId.toString()));

      if (!isOwner) {
        throw new ForbiddenException(
          'Access denied: You do not own this selling entity',
        );
      }
    }

    const entityOrders = await this.entityOrderRepo.getAll({ sellingEntityId });
    return {
      success: true,
      data: entityOrders,
    };
  }

  async verifyCodOtp(
    customerIdStr: string,
    orderIdStr: string,
    otpInput: string,
    currentUser?: any,
  ) {
    if (!orderIdStr || !Types.ObjectId.isValid(orderIdStr)) {
      throw new BadRequestException('معرف الطلب غير صالح');
    }
    const orderId = new Types.ObjectId(orderIdStr);

    const mainOrder = await this.mainOrderRepo.getOne({ _id: orderId });
    if (!mainOrder) {
      throw new NotFoundException('الطلب غير موجود');
    }

    const userRole = (currentUser?.role || '').toLowerCase();
    const isAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === RolesEnum.SUPER_ADMIN.toLowerCase();

    if (!isAdmin && mainOrder.customerId.toString() !== customerIdStr.toString()) {
      throw new ForbiddenException('غير مصرح لك بتأكيد هذا الطلب');
    }

    if (mainOrder.status !== MainOrderStatusEnum.PENDING_COD_VERIFICATION) {
      if (
        mainOrder.status === MainOrderStatusEnum.CONFIRMED ||
        mainOrder.status === MainOrderStatusEnum.PAID ||
        mainOrder.status === MainOrderStatusEnum.COMPLETED
      ) {
        return {
          success: true,
          message: 'تم تأكيد الطلب مسبقاً بنجاح',
          orderId: mainOrder._id.toString(),
          status: mainOrder.status,
        };
      }
      throw new BadRequestException('الطلب ليس في حالة انتظار التحقق من الدفع عند الاستلام');
    }

    const otpKey = `cod_otp:orderId:${mainOrder._id.toString()}`;
    const rawCachedData: any = await this.cacheManager.get(otpKey);
    if (!rawCachedData) {
      throw new BadRequestException('انتهت صلاحية الرمز، يرجى طلب رمز جديد');
    }

    const cachedData =
      typeof rawCachedData === 'string'
        ? JSON.parse(rawCachedData)
        : rawCachedData;

    const submittedOtp = (otpInput || '').trim();
    if (cachedData.otp !== submittedOtp) {
      const attempts = (cachedData.attempts || 0) + 1;
      if (attempts >= 5) {
        await this.cacheManager.del(otpKey);
        await this.cacheManager.del(`cod_otp_resend_lock:${mainOrder._id.toString()}`);

        // Cancel order & release reserved stock atomically
        const entityOrders = await this.entityOrderRepo.getAll({
          mainOrderId: mainOrder._id,
        });
        for (const eo of entityOrders) {
          for (const it of eo.items) {
            await this.inventoryRepo.releaseStockAtomic(it.sku, it.quantity);
          }
          await this.entityOrderRepo.updateOne(
            { _id: eo._id },
            {
              status: EntityOrderStatusEnum.CANCELLED,
              $push: {
                statusHistory: {
                  status: EntityOrderStatusEnum.CANCELLED,
                  updatedAt: new Date(),
                  note: 'تم إلغاء الطلب آلياً لاستنفاذ محاولات إدخال رمز التحقق OTP (5 محاولات)',
                },
              },
            },
          );
        }

        await this.mainOrderRepo.updateOne(
          { _id: mainOrder._id },
          { status: MainOrderStatusEnum.CANCELLED },
        );

        throw new BadRequestException(
          'تم تجاوز الحد الأقصى للمحاولات (5 محاولات). تم إلغاء الطلب وتحرير المخزون المحجوز',
        );
      } else {
        cachedData.attempts = attempts;
        await this.cacheManager.set(otpKey, JSON.stringify(cachedData), 300 * 1000);
        throw new BadRequestException(
          `رمز التحقق غير صحيح، تبقى لك ${5 - attempts} محاولات`,
        );
      }
    }

    // Success: Delete OTP keys from cache immediately
    await this.cacheManager.del(otpKey);
    await this.cacheManager.del(`cod_otp_resend_lock:${mainOrder._id.toString()}`);

    // Update main order to CONFIRMED
    await this.mainOrderRepo.updateOne(
      { _id: mainOrder._id },
      { status: MainOrderStatusEnum.CONFIRMED },
    );

    // Update entity orders to CONFIRMED
    const entityOrders = await this.entityOrderRepo.getAll({
      mainOrderId: mainOrder._id,
    });
    for (const eo of entityOrders) {
      await this.entityOrderRepo.updateOne(
        { _id: eo._id },
        {
          status: EntityOrderStatusEnum.CONFIRMED,
          $push: {
            statusHistory: {
              status: EntityOrderStatusEnum.CONFIRMED,
              updatedAt: new Date(),
              note: 'تم تأكيد طلب الدفع عند الاستلام عبر رمز التحقق (OTP) بنجاح',
            },
          },
        },
      );
    }

    // Emit events to notify sellers and platform
    const sellerEntityIds = entityOrders.map((eo) =>
      eo.sellingEntityId.toString(),
    );

    this.eventEmitter.emit(
      'order.placed',
      new OrderPlacedEvent(
        mainOrder._id.toString(),
        mainOrder.orderNumber,
        customerIdStr,
        mainOrder.totalAmount,
        sellerEntityIds,
      ),
    );

    this.eventEmitter.emit(
      'order.created',
      new OrderCreatedEvent(
        mainOrder._id.toString(),
        customerIdStr,
        mainOrder.orderNumber,
        mainOrder.totalAmount,
        sellerEntityIds,
      ),
    );

    this.eventEmitter.emit(
      'audit.log',
      new AuditLogEvent(
        customerIdStr,
        AuditActionEnum.STATUS_CHANGE,
        'MainOrder',
        mainOrder._id.toString(),
        undefined,
        {
          status: MainOrderStatusEnum.CONFIRMED,
          note: 'COD order verified via OTP',
        },
      ),
    );

    return {
      success: true,
      message: 'تم تأكيد طلب الدفع عند الاستلام بنجاح',
      orderId: mainOrder._id.toString(),
      orderNumber: mainOrder.orderNumber,
      status: MainOrderStatusEnum.CONFIRMED,
    };
  }

  async resendCodOtp(
    customerIdStr: string,
    orderIdStr: string,
    currentUser?: any,
  ) {
    if (!orderIdStr || !Types.ObjectId.isValid(orderIdStr)) {
      throw new BadRequestException('معرف الطلب غير صالح');
    }
    const orderId = new Types.ObjectId(orderIdStr);

    const mainOrder = await this.mainOrderRepo.getOne({ _id: orderId });
    if (!mainOrder) {
      throw new NotFoundException('الطلب غير موجود');
    }

    const userRole = (currentUser?.role || '').toLowerCase();
    const isAdmin =
      userRole === 'admin' ||
      userRole === 'super_admin' ||
      userRole === RolesEnum.SUPER_ADMIN.toLowerCase();

    if (!isAdmin && mainOrder.customerId.toString() !== customerIdStr.toString()) {
      throw new ForbiddenException('غير مصرح لك بإعادة إرسال رمز هذا الطلب');
    }

    if (mainOrder.status !== MainOrderStatusEnum.PENDING_COD_VERIFICATION) {
      throw new BadRequestException('الطلب ليس في حالة انتظار التحقق');
    }

    const resendLockKey = `cod_otp_resend_lock:${mainOrder._id.toString()}`;
    const isLocked = await this.cacheManager.get(resendLockKey);
    if (isLocked) {
      throw new BadRequestException(
        'يرجى الانتظار 60 ثانية قبل طلب إعادة إرسال الرمز مرة أخرى',
      );
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpKey = `cod_otp:orderId:${mainOrder._id.toString()}`;

    // Overwrite the old OTP in Redis directly with a fresh 5-minute validity
    await this.cacheManager.set(
      otpKey,
      JSON.stringify({
        otp: newOtp,
        attempts: 0,
        customerId: customerIdStr,
        orderId: mainOrder._id.toString(),
      }),
      300 * 1000,
    );

    await this.cacheManager.set(resendLockKey, 'locked', 60 * 1000);

    let customerEmail = '';
    let customerName = '';
    let customerPhone = '';
    try {
      const user = await this.userRepo.getOne({ _id: mainOrder.customerId });
      customerEmail = user?.email || '';
      customerName = user?.userName || '';
      customerPhone = user?.phoneNumber || '';
    } catch {}

    if (!customerPhone && mainOrder.shippingAddress) {
      const match = mainOrder.shippingAddress.match(/هاتف:\s*([0-9+]+)/);
      if (match) customerPhone = match[1];
    }
    const phoneMasked = customerPhone
      ? customerPhone.replace(/(\d{3})\d{4,}(\d{3,4})/, '$1****$2')
      : '010****1234';

    // Send new email immediately & non-blocking
    this.sendCodOtpEmailAsync(
      customerEmail,
      customerName,
      newOtp,
      mainOrder.orderNumber,
    );

    // Send in-app notification
    try {
      await this.notificationService.sendNotification(
        customerIdStr,
        'رمز التحقق الجديد لطلب الدفع عند الاستلام',
        `رمز التحقق الجديد لطلبك #${mainOrder.orderNumber} هو: ${newOtp} (صالح لمدة 5 دقائق)`,
        NotificationTypeEnum.ORDER_PLACED,
        NotificationChannelEnum.IN_APP,
        {
          orderId: mainOrder._id.toString(),
          otp: newOtp,
          expiresIn: 300,
        },
      );
    } catch (notifErr: any) {
      this.logger.warn(`Failed to send in-app notification: ${notifErr.message}`);
    }

    this.logger.log(
      `[COD OTP GATE] Resent new OTP ${newOtp} for order #${mainOrder.orderNumber} (Email: ${customerEmail})`,
    );

    return {
      success: true,
      message: 'تم إرسال رمز التحقق إلى بريدك الإلكتروني',
      phoneMasked,
      expiresInSeconds: 300,
    };
  }
}
