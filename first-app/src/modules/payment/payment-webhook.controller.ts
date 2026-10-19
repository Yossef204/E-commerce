import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { MainOrderRepo } from '../../models/order/main-order.repository';
import { PaymentRepo } from '../../models/payment/payment.repository';
import { IdempotencyService } from '../../shared/payment/services/idempotency.service';
import { PaymentStatusEnum } from '../../common/enums/payment-status.enum';
import { MainOrderStatusEnum } from '../../common/enums/main-order-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Controller('payments/webhook')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly idempotencyService: IdempotencyService,
    private readonly mainOrderRepo: MainOrderRepo,
    private readonly paymentRepo: PaymentRepo,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  @Post(':gateway')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('gateway') gateway: string,
    @Body() body: any,
    @Query() query: any,
    @Headers() headers: Record<string, string>,
    @Req() req: any,
  ) {
    const normalizedGateway = (gateway || '').toLowerCase();
    this.logger.log(`Received payment webhook for gateway: ${normalizedGateway}`);

    // 1. Verify Gateway Signature
    this.verifySignature(normalizedGateway, body, query, headers);

    // 2. Extract Event & Transaction Identifiers
    const { transactionId, orderIdentifier, isSuccess } = this.extractDetails(
      normalizedGateway,
      body,
      query,
    );

    if (!transactionId) {
      this.logger.warn(`Webhook received without identifiable transaction ID`);
      return { success: true, message: 'Ignored: No transaction ID found' };
    }

    // 3. Replay Protection & Idempotency Check
    const idempotencyKey = `webhook:${normalizedGateway}:${transactionId}`;
    const acquired = await this.idempotencyService.lock(idempotencyKey, 86400000); // 24 hours
    if (!acquired) {
      this.logger.log(
        `Duplicate webhook event received for transaction ${transactionId}. Returning idempotent 200 OK.`,
      );
      return {
        success: true,
        message: 'Webhook already processed (Idempotent response)',
      };
    }

    // 4. Handle Successful Payment State Transition
    if (isSuccess) {
      await this.processSuccessfulPayment(transactionId, orderIdentifier, body);
    } else {
      this.logger.warn(
        `Payment webhook indicated failure for transaction: ${transactionId}`,
      );
    }

    return {
      success: true,
      gateway: normalizedGateway,
      transactionId,
      status: isSuccess ? 'PROCESSED_SUCCESS' : 'PROCESSED_FAILED',
    };
  }

  /**
   * Cryptographic Signature Verification for Paymob, Stripe, and Mock
   */
  private verifySignature(
    gateway: string,
    body: any,
    query: any,
    headers: Record<string, string>,
  ) {
    if (gateway === 'paymob') {
      const hmacSecret =
        this.configService.get<string>('PAYMOB_HMAC_SECRET') ||
        process.env.PAYMOB_HMAC_SECRET ||
        'mock-paymob-hmac-secret';

      const receivedHmac =
        query.hmac || headers['x-paymob-hmac'] || body.hmac || headers['hmac'];

      if (!receivedHmac && process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Missing Paymob HMAC signature in webhook');
      }

      if (receivedHmac) {
        const obj = body.obj || body;
        const concatenated = [
          obj.amount_cents,
          obj.created_at,
          obj.currency,
          obj.error_occured,
          obj.has_parent_transaction,
          obj.id,
          obj.integration_id,
          obj.is_3d_secure,
          obj.is_auth,
          obj.is_capture,
          obj.is_refunded,
          obj.is_standalone_payment,
          obj.is_voided,
          obj.order?.id || obj['order.id'],
          obj.owner,
          obj.pending,
          obj.source_data?.pan || obj['source_data.pan'],
          obj.source_data?.sub_type || obj['source_data.sub_type'],
          obj.source_data?.type || obj['source_data.type'],
          obj.success,
        ]
          .map((v) => (v === undefined || v === null ? '' : String(v)))
          .join('');

        const computedHmac = crypto
          .createHmac('sha512', hmacSecret)
          .update(concatenated)
          .digest('hex');

        if (
          computedHmac.toLowerCase() !== receivedHmac.toLowerCase() &&
          process.env.NODE_ENV === 'production'
        ) {
          this.logger.error('Paymob HMAC verification mismatch');
          throw new UnauthorizedException('Invalid Paymob signature');
        }
      }
    } else if (gateway === 'stripe') {
      const stripeSecret =
        this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ||
        process.env.STRIPE_WEBHOOK_SECRET ||
        'whsec_mock_stripe_secret';

      const sigHeader = headers['stripe-signature'];
      if (!sigHeader && process.env.NODE_ENV === 'production') {
        throw new UnauthorizedException('Missing Stripe signature header');
      }

      if (sigHeader) {
        try {
          const parts = sigHeader.split(',').reduce((acc: any, part: string) => {
            const [k, v] = part.split('=');
            if (k && v) acc[k.trim()] = v.trim();
            return acc;
          }, {});

          const timestamp = parts['t'];
          const signature = parts['v1'];
          if (timestamp && signature) {
            const payloadStr =
              typeof body === 'string' ? body : JSON.stringify(body);
            const expectedSig = crypto
              .createHmac('sha256', stripeSecret)
              .update(`${timestamp}.${payloadStr}`)
              .digest('hex');

            if (
              expectedSig !== signature &&
              process.env.NODE_ENV === 'production'
            ) {
              throw new UnauthorizedException('Invalid Stripe webhook signature');
            }
          }
        } catch (e: any) {
          if (e instanceof UnauthorizedException) throw e;
          this.logger.warn(`Stripe signature parsing issue: ${e.message}`);
        }
      }
    } else {
      // Internal / Mock gateway signature
      const webhookSecret =
        this.configService.get<string>('PAYMENT_WEBHOOK_SECRET') ||
        process.env.PAYMENT_WEBHOOK_SECRET;

      const receivedSecret = headers['x-webhook-secret'] || query.secret;
      if (
        webhookSecret &&
        receivedSecret !== webhookSecret &&
        process.env.NODE_ENV === 'production'
      ) {
        throw new UnauthorizedException('Invalid internal webhook secret');
      }
    }
  }

  /**
   * Extract standardized identifiers across various gateway payload formats
   */
  private extractDetails(gateway: string, body: any, query: any) {
    let transactionId = '';
    let orderIdentifier = '';
    let isSuccess = false;

    if (gateway === 'paymob') {
      const obj = body.obj || body;
      transactionId = String(obj.id || query.id || '');
      orderIdentifier = String(
        obj.order?.merchant_order_id ||
          obj.order?.id ||
          obj['order.id'] ||
          query.merchant_order_id ||
          '',
      );
      isSuccess = Boolean(obj.success === true || obj.success === 'true');
    } else if (gateway === 'stripe') {
      const obj = body.data?.object || body;
      transactionId = String(obj.id || '');
      orderIdentifier = String(
        obj.metadata?.orderNumber ||
          obj.metadata?.orderId ||
          obj.client_reference_id ||
          '',
      );
      isSuccess = Boolean(
        body.type === 'payment_intent.succeeded' ||
          body.type === 'checkout.session.completed' ||
          obj.status === 'succeeded',
      );
    } else {
      transactionId = String(body.transactionId || body.id || query.id || '');
      orderIdentifier = String(
        body.orderNumber || body.orderId || query.orderNumber || '',
      );
      isSuccess = Boolean(body.success ?? true);
    }

    return { transactionId, orderIdentifier, isSuccess };
  }

  /**
   * Process successful payment: update Payment & MainOrder to PAID
   */
  private async processSuccessfulPayment(
    transactionId: string,
    orderIdentifier: string,
    rawPayload: any,
  ) {
    // 1. Search payment by transactionId
    let payment = await this.paymentRepo.getOne({ transactionId });

    // 2. If not found by transactionId, search by order number / order ID
    if (!payment && orderIdentifier) {
      let mainOrder = await this.mainOrderRepo.getOne({
        orderNumber: orderIdentifier,
      });
      if (!mainOrder && orderIdentifier.match(/^[0-9a-fA-F]{24}$/)) {
        mainOrder = await this.mainOrderRepo.getOne({
          _id: orderIdentifier as any,
        });
      }

      if (mainOrder) {
        payment = await this.paymentRepo.getOne({
          mainOrderId: mainOrder._id,
        });
      }
    }

    if (payment) {
      if (payment.status !== PaymentStatusEnum.CAPTURED) {
        await this.paymentRepo.updateOne(
          { _id: payment._id },
          {
            $set: {
              status: PaymentStatusEnum.CAPTURED,
              transactionId,
            },
          },
        );

        await this.mainOrderRepo.updateOne(
          { _id: payment.mainOrderId },
          {
            $set: {
              status: MainOrderStatusEnum.PAID,
            },
          },
        );

        this.logger.log(
          `Payment for Order ${payment.mainOrderId} transitioned to CAPTURED / PAID via webhook`,
        );

        this.eventEmitter.emit('payment.received', {
          mainOrderId: payment.mainOrderId,
          transactionId,
          amount: payment.amount,
        });
      }
    } else {
      this.logger.warn(
        `Webhook verified but matching payment record not found for transaction: ${transactionId}, order: ${orderIdentifier}`,
      );
    }
  }
}

