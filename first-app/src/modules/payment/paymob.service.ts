import {
  Injectable,
  Logger,
  BadRequestException,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export interface PaymobBillingData {
  firstName?: string;
  lastName?: string;
  email?: string;
  phoneNumber?: string;
  apartment?: string;
  floor?: string;
  street?: string;
  building?: string;
  postalCode?: string;
  city?: string;
  country?: string;
  state?: string;
  [key: string]: any;
}

export interface InitiatePaymentParams {
  amount: number;
  orderId?: string;
  billingData?: PaymobBillingData;
  items?: any[];
}

export interface InitiatePaymentResult {
  success: boolean;
  iframeUrl: string;
  paymentKey: string;
  paymobOrderId: number;
  amount: number;
  currency: string;
}

@Injectable()
export class PaymobService {
  private readonly logger = new Logger(PaymobService.name);

  constructor(private readonly configService: ConfigService) {}

  private get apiKey(): string {
    return this.configService.get<string>('paymob.apiKey') || '';
  }

  private get integrationIdCard(): string {
    return this.configService.get<string>('paymob.integrationIdCard') || '';
  }

  private get integrationIdWallet(): string {
    return this.configService.get<string>('paymob.integrationIdWallet') || '';
  }

  private get iframeId(): string {
    return this.configService.get<string>('paymob.iframeId') || '';
  }

  private get hmacSecret(): string {
    return this.configService.get<string>('paymob.hmacSecret') || '';
  }

  private get baseUrl(): string {
    return (
      this.configService.get<string>('paymob.baseUrl') ||
      'https://accept.paymob.com/api'
    );
  }

  public getPublicIframeId(): string {
    return this.iframeId;
  }

  /**
   * Step 1: Authentication Request to acquire Auth Token
   * POST /auth/tokens
   */
  async authenticate(): Promise<string> {
    const key = this.apiKey;
    if (!key) {
      throw new InternalServerErrorException(
        'Paymob API key is not configured in paymob.config',
      );
    }

    try {
      this.logger.log('Step 1: Requesting Paymob authentication token...');
      const response = await fetch(`${this.baseUrl}/auth/tokens`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ api_key: key }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(`Paymob auth failed: ${response.status} - ${errorText}`);
        throw new UnauthorizedException(
          `Paymob authentication failed: ${errorText}`,
        );
      }

      const data = await response.json();
      return data.token;
    } catch (err: any) {
      if (err instanceof UnauthorizedException) throw err;
      this.logger.error(`Paymob auth network error: ${err.message}`);
      throw new InternalServerErrorException(
        `Failed to connect to Paymob authentication service: ${err.message}`,
      );
    }
  }

  /**
   * Step 2: Order Registration API
   * POST /ecommerce/orders
   */
  async registerOrder(
    authToken: string,
    amount: number,
    merchantOrderId?: string,
    items: any[] = [],
  ): Promise<any> {
    const amountCents = Math.round(Number(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) {
      throw new BadRequestException('Invalid order amount for Paymob');
    }

    const payload = {
      auth_token: authToken,
      delivery_needed: 'false',
      amount_cents: amountCents,
      currency: 'EGP',
      merchant_order_id:
        merchantOrderId ||
        `ORD_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
      items: Array.isArray(items) ? items : [],
    };

    try {
      this.logger.log(
        `Step 2: Registering Paymob order for ${amount} EGP (${amountCents} cents)...`,
      );
      const response = await fetch(`${this.baseUrl}/ecommerce/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Paymob order registration failed: ${response.status} - ${errorText}`,
        );
        throw new BadRequestException(
          `Paymob order registration rejected: ${errorText}`,
        );
      }

      return await response.json();
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Paymob order registration error: ${err.message}`);
      throw new InternalServerErrorException(
        `Failed to register order with Paymob: ${err.message}`,
      );
    }
  }

  /**
   * Step 3: Payment Key Request
   * POST /acceptance/payment_keys
   */
  async generatePaymentKey(
    authToken: string,
    paymobOrderId: number,
    amount: number,
    billingData?: PaymobBillingData,
    integrationId?: string | number,
  ): Promise<string> {
    const amountCents = Math.round(Number(amount) * 100);
    const intId = integrationId || this.integrationIdCard;

    if (!intId) {
      throw new InternalServerErrorException(
        'Paymob card integration ID is not configured',
      );
    }

    // Comprehensive billing_data to avoid 400 Bad Request
    const formattedBilling = {
      apartment: billingData?.apartment || 'NA',
      email: billingData?.email || 'customer@example.com',
      floor: billingData?.floor || 'NA',
      first_name:
        billingData?.firstName || billingData?.first_name || 'Customer',
      street: billingData?.street || 'NA',
      building: billingData?.building || 'NA',
      phone_number:
        billingData?.phoneNumber ||
        billingData?.phone_number ||
        '+201000000000',
      shipping_method: 'PKG',
      postal_code: billingData?.postalCode || billingData?.postal_code || 'NA',
      city: billingData?.city || 'Cairo',
      country: billingData?.country || 'EGY',
      last_name:
        billingData?.lastName || billingData?.last_name || 'Shopper',
      state: billingData?.state || 'Cairo',
    };

    const payload = {
      auth_token: authToken,
      amount_cents: amountCents,
      expiration: 3600,
      order_id: paymobOrderId,
      billing_data: formattedBilling,
      currency: 'EGP',
      integration_id: Number(intId),
      lock_order_when_paid: 'false',
    };

    try {
      this.logger.log(
        `Step 3: Generating Paymob payment key with integration ${intId}...`,
      );
      const response = await fetch(`${this.baseUrl}/acceptance/payment_keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          `Paymob payment key request failed: ${response.status} - ${errorText}`,
        );
        throw new BadRequestException(
          `Paymob payment key generation rejected: ${errorText}`,
        );
      }

      const data = await response.json();
      return data.token;
    } catch (err: any) {
      if (err instanceof BadRequestException) throw err;
      this.logger.error(`Paymob payment key error: ${err.message}`);
      throw new InternalServerErrorException(
        `Failed to generate Paymob payment key: ${err.message}`,
      );
    }
  }

  /**
   * Executes the full 3-step Card Payment flow and produces the live iFrame URL
   */
  async initiateCardPayment(
    params: InitiatePaymentParams,
  ): Promise<InitiatePaymentResult> {
    const iframe = this.iframeId;
    if (!iframe) {
      throw new InternalServerErrorException(
        'Paymob iframe ID is not configured in paymob.config',
      );
    }

    // Step 1: Authentication Token
    const authToken = await this.authenticate();

    // Step 2: Register Order
    const paymobOrder = await this.registerOrder(
      authToken,
      params.amount,
      params.orderId,
      params.items,
    );

    // Step 3: Payment Key
    const paymentKey = await this.generatePaymentKey(
      authToken,
      paymobOrder.id,
      params.amount,
      params.billingData,
    );

    // Step 4: Construct iframe URL
    // Format: https://accept.paymob.com/api/acceptance/iframes/{iframe_id}?payment_token={payment_token}
    const cleanBase = this.baseUrl.replace(/\/api\/?$/, '');
    const iframeUrl = `${cleanBase}/api/acceptance/iframes/${iframe}?payment_token=${paymentKey}`;

    this.logger.log(
      `Paymob card session successfully created for Order ${params.orderId || paymobOrder.id}`,
    );

    return {
      success: true,
      iframeUrl,
      paymentKey,
      paymobOrderId: paymobOrder.id,
      amount: params.amount,
      currency: 'EGP',
    };
  }

  /**
   * HMAC-SHA512 Cryptographic Signature Verification
   * Formats the required Paymob fields and verifies against incoming query.hmac
   */
  verifyHmac(query: any = {}, body: any = {}, headers: any = {}): boolean {
    const secret = this.hmacSecret;
    if (!secret) {
      this.logger.warn('Paymob HMAC secret is not configured; verification skipped');
      return false;
    }

    const receivedHmac =
      query?.hmac ||
      headers?.['x-paymob-hmac'] ||
      body?.hmac ||
      headers?.['hmac'];

    if (!receivedHmac || typeof receivedHmac !== 'string') {
      return false;
    }

    const obj = body?.obj || body || query;

    // 1. Standard 20-field Paymob Transaction Processed concatenation
    const standardFields = [
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
      obj.order?.id ?? obj['order.id'] ?? obj.order,
      obj.owner,
      obj.pending,
      obj.source_data?.pan ?? obj['source_data.pan'],
      obj.source_data?.sub_type ?? obj['source_data.sub_type'],
      obj.source_data?.type ?? obj['source_data.type'],
      obj.success,
    ]
      .map((val) => (val === undefined || val === null ? '' : String(val)))
      .join('');

    const standardHmac = crypto
      .createHmac('sha512', secret)
      .update(standardFields)
      .digest('hex');

    if (standardHmac.toLowerCase() === receivedHmac.toLowerCase()) {
      return true;
    }

    // 2. Classic 14-field concatenation
    const classicFields = [
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
      obj.order?.id ?? obj['order.id'] ?? obj.order ?? obj.order_id,
    ]
      .map((val) => (val === undefined || val === null ? '' : String(val)))
      .join('');

    const classicHmac = crypto
      .createHmac('sha512', secret)
      .update(classicFields)
      .digest('hex');

    if (classicHmac.toLowerCase() === receivedHmac.toLowerCase()) {
      return true;
    }

    // 3. Alphabetical query parameter concatenation fallback (for redirect callbacks)
    if (query && typeof query === 'object') {
      const sortedKeys = Object.keys(query)
        .filter((k) => k.toLowerCase() !== 'hmac')
        .sort();

      const alphaConcat = sortedKeys
        .map((k) => (query[k] === undefined || query[k] === null ? '' : String(query[k])))
        .join('');

      const alphaHmac = crypto
        .createHmac('sha512', secret)
        .update(alphaConcat)
        .digest('hex');

      if (alphaHmac.toLowerCase() === receivedHmac.toLowerCase()) {
        return true;
      }
    }

    return false;
  }
}
