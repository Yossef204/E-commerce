"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv = require("dotenv");
const path = require("path");
dotenv.config({ path: path.resolve(__dirname, '../.env') });
const paymob_service_1 = require("../src/modules/payment/paymob.service");
async function testPaymobFlow() {
    console.log('--- Testing Paymob Gateway Live Integration ---');
    const configMap = {
        'paymob.apiKey': process.env.PAYMOB_API_KEY,
        'paymob.integrationIdCard': process.env.PAYMOB_INTEGRATION_ID_CARD || process.env.PAYMOB_INTEGRATION_ID,
        'paymob.integrationIdWallet': process.env.PAYMOB_INTEGRATION_ID_WALLET,
        'paymob.iframeId': process.env.PAYMOB_IFRAME_ID,
        'paymob.hmacSecret': process.env.PAYMOB_HMAC_SECRET || process.env.PAYMOB_HMAC,
        'paymob.baseUrl': process.env.PAYMOB_BASE_URL || 'https://accept.paymob.com/api',
    };
    const mockConfigService = {
        get: (key) => configMap[key],
    };
    const paymobService = new paymob_service_1.PaymobService(mockConfigService);
    console.log('1. Configuration values loaded:');
    console.log('   Base URL:', mockConfigService.get('paymob.baseUrl'));
    console.log('   Card Integration ID:', mockConfigService.get('paymob.integrationIdCard'));
    console.log('   iFrame ID:', mockConfigService.get('paymob.iframeId'));
    console.log('   API Key present:', Boolean(mockConfigService.get('paymob.apiKey')));
    console.log('   HMAC Secret present:', Boolean(mockConfigService.get('paymob.hmacSecret')));
    console.log('\n2. Executing Full 3-Step Card Payment Session...');
    try {
        const result = await paymobService.initiateCardPayment({
            amount: 150,
            orderId: `TEST_ORD_${Date.now()}`,
            billingData: {
                firstName: 'Ahmed',
                lastName: 'Mohamed',
                email: 'ahmed.test@example.com',
                phoneNumber: '+201012345678',
                city: 'Cairo',
                street: 'El Tahrir St',
                building: '10',
                apartment: '4B',
                floor: '4',
                postalCode: '11511',
                country: 'EGY',
                state: 'Cairo',
            },
        });
        console.log('   ✓ Session Initialized Successfully!');
        console.log('   - Paymob Order ID:', result.paymobOrderId);
        console.log('   - Amount:', result.amount, result.currency);
        console.log('   - Payment Key:', result.paymentKey ? `${result.paymentKey.substring(0, 25)}...` : 'NONE');
        console.log('   - iFrame URL:', result.iframeUrl);
    }
    catch (err) {
        console.error('   ✗ Paymob Initiation Error:', err.message);
    }
    console.log('\n3. Testing HMAC Verification Logic...');
    const testPayload = {
        amount_cents: '15000',
        created_at: '2026-11-05T00:00:00.000Z',
        currency: 'EGP',
        error_occured: 'false',
        has_parent_transaction: 'false',
        id: '12345678',
        integration_id: String(mockConfigService.get('paymob.integrationIdCard')),
        is_3d_secure: 'true',
        is_auth: 'false',
        is_capture: 'false',
        is_refunded: 'false',
        is_standalone_payment: 'true',
        is_voided: 'false',
        order: { id: 87654321 },
        owner: '1111',
        pending: 'false',
        source_data: { pan: '2346', sub_type: 'MasterCard', type: 'card' },
        success: 'true',
    };
    const secret = mockConfigService.get('paymob.hmacSecret');
    const crypto = await Promise.resolve().then(() => require('crypto'));
    const standardFields = [
        testPayload.amount_cents,
        testPayload.created_at,
        testPayload.currency,
        testPayload.error_occured,
        testPayload.has_parent_transaction,
        testPayload.id,
        testPayload.integration_id,
        testPayload.is_3d_secure,
        testPayload.is_auth,
        testPayload.is_capture,
        testPayload.is_refunded,
        testPayload.is_standalone_payment,
        testPayload.is_voided,
        testPayload.order.id,
        testPayload.owner,
        testPayload.pending,
        testPayload.source_data.pan,
        testPayload.source_data.sub_type,
        testPayload.source_data.type,
        testPayload.success,
    ].join('');
    const validHmac = crypto.createHmac('sha512', secret).update(standardFields).digest('hex');
    const verified = paymobService.verifyHmac({ hmac: validHmac }, { obj: testPayload });
    console.log('   ✓ HMAC Test for Valid Signature:', verified ? 'PASS (Valid)' : 'FAIL');
    const tampered = paymobService.verifyHmac({ hmac: 'invalid_hmac_hash_123456' }, { obj: testPayload });
    console.log('   ✓ HMAC Test for Invalid Signature:', !tampered ? 'PASS (Correctly Rejected)' : 'FAIL');
    console.log('\n--- Paymob Verification Finished ---');
}
testPaymobFlow();
//# sourceMappingURL=test-paymob-live.js.map