import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Header,
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
import { PaymentMethodEnum } from '../../common/enums/payment-method.enum';
import { MainOrderStatusEnum } from '../../common/enums/main-order-status.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Public } from '../../common/decorators/public.decorator';
import { PaymobService } from './paymob.service';

@Public()
@Controller('payments/webhook')
export class PaymentWebhookController {
  private readonly logger = new Logger(PaymentWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly idempotencyService: IdempotencyService,
    private readonly mainOrderRepo: MainOrderRepo,
    private readonly paymentRepo: PaymentRepo,
    private readonly eventEmitter: EventEmitter2,
    private readonly paymobService: PaymobService,
  ) {}

  /**
   * Primary Webhook Receiver (Server-to-Server POST Callback)
   */
  @Post(':gateway')
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Param('gateway') gateway: string,
    @Body() body: any = {},
    @Query() query: any = {},
    @Headers() headers: Record<string, string> = {},
    @Req() req: any = {},
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
   * Browser Redirection Receiver (Client GET Callback from iFrame)
   * Handles user redirect when 3D Secure / transaction finishes
   */
  @Get(':gateway')
  @Header('Content-Type', 'text/html; charset=utf-8')
  async handleRedirect(
    @Param('gateway') gateway: string,
    @Query() query: any = {},
    @Headers() headers: Record<string, string> = {},
    @Req() req: any = {},
  ) {
    const normalizedGateway = (gateway || '').toLowerCase();
    this.logger.log(`Received payment redirect for gateway: ${normalizedGateway}`);

    let isSuccess = false;
    let transactionId = '';
    let orderIdentifier = '';

    try {
      this.verifySignature(normalizedGateway, {}, query, headers);
      const details = this.extractDetails(normalizedGateway, {}, query);
      transactionId = details.transactionId;
      orderIdentifier = details.orderIdentifier;
      isSuccess = details.isSuccess;

      if (transactionId && isSuccess) {
        await this.processSuccessfulPayment(transactionId, orderIdentifier, query);
      }
    } catch (err: any) {
      this.logger.error(`Error processing redirect callback: ${err.message}`);
    }

    // Return responsive HTML informing customer and broadcasting message to parent window
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>نتيجة عملية الدفع</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
      background: #f1f5f9;
      color: #1e293b;
    }
    .card {
      background: #ffffff;
      padding: 2.5rem;
      border-radius: 1.25rem;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
      max-width: 440px;
      width: 90%;
      text-align: center;
      animation: fadeIn 0.4s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .icon {
      width: 72px;
      height: 72px;
      margin: 0 auto 1.5rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2.5rem;
    }
    .icon-success {
      background: #dcfce7;
      color: #16a34a;
    }
    .icon-fail {
      background: #fee2e2;
      color: #dc2626;
    }
    h2 {
      margin: 0 0 0.5rem;
      font-size: 1.5rem;
      font-weight: 700;
    }
    p {
      color: #64748b;
      font-size: 0.95rem;
      line-height: 1.6;
      margin: 0 0 1.5rem;
    }
    .badge {
      display: inline-block;
      padding: 0.35rem 0.75rem;
      border-radius: 0.5rem;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      font-family: monospace;
      font-size: 0.85rem;
      color: #475569;
      margin-bottom: 1.5rem;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon ${isSuccess ? 'icon-success' : 'icon-fail'}">
      ${isSuccess ? '✓' : '✕'}
    </div>
    <h2>${isSuccess ? 'تم تأكيد الدفع بنجاح' : 'تعذر إتمام عملية الدفع'}</h2>
    <p>
      ${
        isSuccess
          ? 'تم استلام المبلغ وتأكيد طلبك بنجاح. جاري توجيهك إلى صفحة تفاصيل الطلب...'
          : 'حدث خطأ أثناء معالجة البطاقة البنكية أو تم إلغاء المعاملة. يمكنك إعادة المحاولة.'
      }
    </p>
    ${
      transactionId
        ? `<div class="badge">رقم المعاملة: ${transactionId}</div>`
        : ''
    }
  </div>

  <script>
    const result = {
      type: 'PAYMOB_PAYMENT_COMPLETED',
      success: ${Boolean(isSuccess)},
      transactionId: '${transactionId || ''}',
      orderIdentifier: '${orderIdentifier || ''}'
    };

    // Broadcast result to parent / opener windows
    if (window.parent && window.parent !== window) {
      window.parent.postMessage(result, '*');
    }
    if (window.opener) {
      window.opener.postMessage(result, '*');
    }
  </script>
</body>
</html>`;
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
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    if (gateway === 'paymob') {
      const isValid = this.paymobService.verifyHmac(query, body, headers);
      const receivedHmac =
        query?.hmac || headers['x-paymob-hmac'] || body?.hmac || headers['hmac'];

      if (!receivedHmac && isProduction) {
        throw new UnauthorizedException('Missing Paymob HMAC signature in webhook');
      }

      if (receivedHmac && !isValid && isProduction) {
        this.logger.error('Paymob HMAC signature verification mismatch');
        throw new UnauthorizedException('Invalid Paymob signature');
      }
    } else if (gateway === 'stripe') {
      const stripeSecret =
        this.configService.get<string>('STRIPE_WEBHOOK_SECRET') ||
        'whsec_mock_stripe_secret';

      const sigHeader = headers['stripe-signature'];
      if (!sigHeader && isProduction) {
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

            if (expectedSig !== signature && isProduction) {
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
        this.configService.get<string>('PAYMENT_WEBHOOK_SECRET');

      const receivedSecret = headers['x-webhook-secret'] || query?.secret;
      if (
        webhookSecret &&
        receivedSecret !== webhookSecret &&
        isProduction
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
      const obj = body?.obj || body || query;
      transactionId = String(obj.id || query?.id || '');
      orderIdentifier = String(
        obj.order?.merchant_order_id ||
          obj.merchant_order_id ||
          query?.merchant_order_id ||
          obj.order?.id ||
          obj['order.id'] ||
          query?.order ||
          '',
      );
      isSuccess = Boolean(
        obj.success === true ||
          obj.success === 'true' ||
          query?.success === 'true',
      );
    } else if (gateway === 'stripe') {
      const obj = body?.data?.object || body;
      transactionId = String(obj?.id || '');
      orderIdentifier = String(
        obj?.metadata?.orderNumber ||
          obj?.metadata?.orderId ||
          obj?.client_reference_id ||
          '',
      );
      isSuccess = Boolean(
        body?.type === 'payment_intent.succeeded' ||
          body?.type === 'checkout.session.completed' ||
          obj?.status === 'succeeded',
      );
    } else {
      transactionId = String(body?.transactionId || body?.id || query?.id || '');
      orderIdentifier = String(
        body?.orderNumber || body?.orderId || query?.orderNumber || '',
      );
      isSuccess = Boolean(body?.success ?? true);
    }

    return { transactionId, orderIdentifier, isSuccess };
  }

  /**
   * Process successful payment: update Payment & MainOrder to PAID / CAPTURED
   */
  private async processSuccessfulPayment(
    transactionId: string,
    orderIdentifier: string,
    rawPayload: any,
  ) {
    // 1. Search payment by transactionId
    let payment = await this.paymentRepo.getOne({ transactionId });
    let mainOrder: any = null;

    // 2. If not found by transactionId, search by order number / order ID
    if (!payment && orderIdentifier) {
      mainOrder = await this.mainOrderRepo.getOne({
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
    } else if (mainOrder) {
      // Create payment document if not existed yet and capture
      payment = await this.paymentRepo.create({
        mainOrderId: mainOrder._id,
        customerId: mainOrder.customerId,
        amount: mainOrder.totalAmount,
        currency: 'EGP',
        paymentMethod: PaymentMethodEnum.CARD,
        status: PaymentStatusEnum.CAPTURED,
        transactionId,
        idempotencyKey: `paymob-webhook-${transactionId}`,
      });

      await this.mainOrderRepo.updateOne(
        { _id: mainOrder._id },
        {
          $set: {
            status: MainOrderStatusEnum.PAID,
          },
        },
      );

      this.logger.log(
        `Created Payment ${payment._id} and transitioned Order ${mainOrder._id} to PAID via Paymob webhook`,
      );

      this.eventEmitter.emit('payment.received', {
        mainOrderId: mainOrder._id,
        transactionId,
        amount: payment.amount,
      });
    } else {
      this.logger.warn(
        `Webhook verified but matching payment/order record not found for transaction: ${transactionId}, order: ${orderIdentifier}`,
      );
    }
  }
}
