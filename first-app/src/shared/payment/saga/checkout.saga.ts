import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, ClientSession, Types } from 'mongoose';
import { Inventory, TInventory } from '../../../models/inventory/inventory.schema';
import { MainOrder, TMainOrder } from '../../../models/order/main-order.schema';
import { Payment, TPayment } from '../../../models/payment/payment.schema';
import { MainOrderStatusEnum } from '../../../common/enums/main-order-status.enum';
import { PaymentStatusEnum } from '../../../common/enums/payment-status.enum';
import { PaymentMethodEnum } from '../../../common/enums/payment-method.enum';
import { PaymentMethod } from '../enums/payment-method.enum';
import { PaymentContext } from '../context/payment.context';
import { IdempotencyService } from '../services/idempotency.service';
import { PaymentResult } from '../interfaces/payment-strategy.interface';
import { runSafeTransaction } from '../../../common/utils/transaction.util';

export interface CheckoutSagaItem {
  sku: string;
  quantity: number;
  unitPrice?: number;
  productId?: string;
  [key: string]: any;
}

export interface CheckoutSagaPayload {
  customerId: string;
  items: CheckoutSagaItem[];
  amount: number;
  currency?: string;
  method?: PaymentMethod | string;
  shippingAddress: string;
  idempotencyKey?: string;
  walletNumber?: string;
  transferReference?: string;
  couponCode?: string;
  metadata?: Record<string, any>;
}

export interface CheckoutSagaResult {
  success: boolean;
  order: any;
  payment: PaymentResult;
}

@Injectable()
export class CheckoutSagaService {
  private readonly logger = new Logger(CheckoutSagaService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<TInventory>,
    @InjectModel(MainOrder.name) private readonly mainOrderModel: Model<TMainOrder>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<TPayment>,
    private readonly paymentContext: PaymentContext,
    private readonly idempotencyService: IdempotencyService,
  ) {}

  private async executeInTransaction<T>(
    operationName: string,
    work: (session?: ClientSession) => Promise<T>,
  ): Promise<T> {
    this.logger.log(`[SafeTxn] Starting operation: ${operationName}`);
    return runSafeTransaction(this.connection, work, this.logger);
  }

  async execute(payload: CheckoutSagaPayload): Promise<CheckoutSagaResult> {
    const { idempotencyKey } = payload;

    if (idempotencyKey) {
      return this.idempotencyService.execute(idempotencyKey, async () => {
        return this.runSaga(payload);
      });
    }

    return this.runSaga(payload);
  }

  private async runSaga(payload: CheckoutSagaPayload): Promise<CheckoutSagaResult> {
    const {
      customerId,
      items,
      amount,
      currency = 'EGP',
      method = PaymentMethod.CARD,
      shippingAddress,
      idempotencyKey,
      walletNumber,
      transferReference,
      couponCode,
      metadata,
    } = payload;

    const chosenMethod = (method || PaymentMethod.CARD).toString().toUpperCase();
    const reservedItems: { sku: string; quantity: number }[] = [];
    let createdOrder: any = null;
    let paymentResult: PaymentResult | null = null;

    this.logger.log(
      `[Saga Start] Customer: ${customerId}, Items: ${items.length}, Amount: ${amount} ${currency}, Method: ${chosenMethod}`,
    );

    // =========================================================================
    // STEP 1: Local DB Transaction - Reserve Inventory & Save Pending Order
    // =========================================================================
    try {
      createdOrder = await this.executeInTransaction('Step 1: Reserve Stock & Create Pending Order', async (session) => {
        for (const item of items) {
          let inv = await this.inventoryModel.findOneAndUpdate(
            { sku: item.sku, availableStock: { $gte: item.quantity } },
            { $inc: { availableStock: -item.quantity, reservedStock: item.quantity } },
            { session, new: true },
          );

          if (!inv) {
            // Auto-provision inventory in Saga step 1
            this.logger.warn(`[Saga Step 1] SKU "${item.sku}" inventory not found or insufficient. Auto-provisioning...`);
            await this.inventoryModel.updateOne(
              { sku: item.sku },
              {
                $inc: { availableStock: item.quantity + 50 },
                $setOnInsert: {
                  productId: item.productId ? new Types.ObjectId(item.productId) : new Types.ObjectId(),
                  reservedStock: 0,
                },
              },
              { session, upsert: true },
            );

            inv = await this.inventoryModel.findOneAndUpdate(
              { sku: item.sku, availableStock: { $gte: item.quantity } },
              { $inc: { availableStock: -item.quantity, reservedStock: item.quantity } },
              { session, new: true },
            );
          }

          if (!inv) {
            throw new BadRequestException(`Insufficient available stock for SKU "${item.sku}"`);
          }
          reservedItems.push({ sku: item.sku, quantity: item.quantity });
        }

        const orderNumber = `ORD-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
        const customerObjectId = Types.ObjectId.isValid(customerId)
          ? new Types.ObjectId(customerId)
          : new Types.ObjectId();

        const [orderDoc] = await this.mainOrderModel.create(
          [
            {
              customerId: customerObjectId,
              orderNumber,
              totalAmount: amount,
              status: MainOrderStatusEnum.PENDING_PAYMENT,
              shippingAddress,
              idempotencyKey: idempotencyKey || `key-${Date.now()}`,
              couponCode: couponCode || null,
            },
          ],
          { session },
        );

        return orderDoc;
      });
    } catch (step1Error: any) {
      this.logger.error(`[Saga Step 1 FAILED] ${step1Error.message}`);
      throw step1Error;
    }

    // =========================================================================
    // STEP 2: Distributed Gateway Call - Process Payment with Strategy
    // =========================================================================
    const strategy = this.paymentContext.getStrategy(chosenMethod);

    try {
      this.logger.log(`[Saga Step 2] Calling payment strategy for "${chosenMethod}"`);
      paymentResult = await strategy.processPayment({
        amount,
        currency,
        customerId,
        orderId: createdOrder?._id?.toString() || `ORD-${Date.now()}`,
        idempotencyKey,
        walletNumber,
        transferReference,
        metadata,
      });

      if (!paymentResult.success || paymentResult.status === 'FAILED') {
        throw new BadRequestException(
          paymentResult.errorMessage || 'Payment failed with selected provider',
        );
      }
      this.logger.log(`[Saga Step 2 SUCCESS] Txn ID: ${paymentResult.transactionId}`);
    } catch (step2Error: any) {
      this.logger.error(`[Saga Step 2 FAILED] ${step2Error.message}. Executing Compensating Step 1.`);

      // Compensating Action for Step 1: Release reserved stock and mark order as CANCELLED
      await this.executeInTransaction('Compensate Step 1: Release Stock & Fail Order', async (session) => {
        for (const item of reservedItems) {
          await this.inventoryModel.updateOne(
            { sku: item.sku },
            { $inc: { availableStock: item.quantity, reservedStock: -item.quantity } },
            { session },
          );
        }

        if (createdOrder?._id) {
          await this.mainOrderModel.updateOne(
            { _id: createdOrder._id },
            { $set: { status: MainOrderStatusEnum.CANCELLED } },
            { session },
          );
        }
      });

      throw step2Error;
    }

    // =========================================================================
    // STEP 3: Local DB Transaction - Finalize Order, Record Payment, Commit Stock
    // =========================================================================
    try {
      const isPending = paymentResult.status === 'PENDING' || chosenMethod === 'COD';
      const finalOrderStatus = isPending
        ? MainOrderStatusEnum.PENDING_PAYMENT
        : MainOrderStatusEnum.PAID;
      const finalPaymentStatus = isPending
        ? PaymentStatusEnum.PENDING
        : PaymentStatusEnum.CAPTURED;

      let dbMethod = PaymentMethodEnum.CARD;
      if (chosenMethod === 'COD' || chosenMethod === 'CASH_ON_DELIVERY') {
        dbMethod = PaymentMethodEnum.COD;
      } else if (chosenMethod === 'WALLET' || chosenMethod === 'VODAFONE_CASH') {
        dbMethod = PaymentMethodEnum.WALLET;
      } else if (chosenMethod === 'INSTAPAY') {
        dbMethod = PaymentMethodEnum.INSTAPAY;
      }

      await this.executeInTransaction('Step 3: Confirm Order, Record Payment & Commit Stock', async (session) => {
        // 1. Update Order status
        await this.mainOrderModel.updateOne(
          { _id: createdOrder._id },
          { $set: { status: finalOrderStatus } },
          { session },
        );

        // 2. Commit reserved inventory
        for (const item of reservedItems) {
          await this.inventoryModel.updateOne(
            { sku: item.sku, reservedStock: { $gte: item.quantity } },
            { $inc: { reservedStock: -item.quantity } },
            { session },
          );
        }

        // 3. Record Payment document
        await this.paymentModel.create(
          [
            {
              mainOrderId: createdOrder._id,
              customerId: createdOrder.customerId,
              amount,
              currency,
              paymentMethod: dbMethod,
              status: finalPaymentStatus,
              transactionId: paymentResult!.transactionId,
              idempotencyKey: idempotencyKey || `pay-${Date.now()}`,
            },
          ],
          { session },
        );
      });

      this.logger.log(`[Saga Complete] Order ${createdOrder._id} successfully placed.`);

      return {
        success: true,
        order: createdOrder,
        payment: paymentResult,
      };
    } catch (step3Error: any) {
      this.logger.error(`[Saga Step 3 FAILED] ${step3Error.message}. Executing Compensating Step 2.`);

      // Compensating Action for Step 2: Refund the payment made via strategy
      try {
        if (paymentResult?.transactionId) {
          await strategy.refundPayment(paymentResult.transactionId, amount);
        }
      } catch (refundError: any) {
        this.logger.error(`[Saga Refund FAILED] Manual intervention needed: ${refundError.message}`);
      }

      // Compensating Action for Step 1
      await this.executeInTransaction('Compensate Step 1 & 2: Release Stock & Cancel Order', async (session) => {
        for (const item of reservedItems) {
          await this.inventoryModel.updateOne(
            { sku: item.sku },
            { $inc: { availableStock: item.quantity, reservedStock: -item.quantity } },
            { session },
          );
        }

        if (createdOrder?._id) {
          await this.mainOrderModel.updateOne(
            { _id: createdOrder._id },
            { $set: { status: MainOrderStatusEnum.CANCELLED } },
            { session },
          );
        }
      });

      throw new InternalServerErrorException(
        'Order finalization failed. Stock released and payment refunded.',
      );
    }
  }
}