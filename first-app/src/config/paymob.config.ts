import { registerAs } from '@nestjs/config';

export default registerAs('paymob', () => ({
  apiKey: process.env.PAYMOB_API_KEY || '',
  integrationIdCard:
    process.env.PAYMOB_INTEGRATION_ID_CARD ||
    process.env.PAYMOB_INTEGRATION_ID ||
    '',
  integrationIdWallet: process.env.PAYMOB_INTEGRATION_ID_WALLET || '',
  iframeId: process.env.PAYMOB_IFRAME_ID || '',
  hmacSecret:
    process.env.PAYMOB_HMAC_SECRET || process.env.PAYMOB_HMAC || '',
  baseUrl: process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com/api',
}));

