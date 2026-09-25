const axios = require('axios');
const querystring = require('querystring');

/**
 * Modular Payment Service (SSLCommerz Implementation)
 * Can be swapped easily for Stripe, Cryptomus, bKash, etc.
 */

const isSandbox = (process.env.GATEWAY_SANDBOX || 'true').toLowerCase() === 'true';

const SSLCOMMERZ_INIT_URL = isSandbox
  ? 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
  : 'https://securepay.sslcommerz.com/gwprocess/v4/api.php';

const SSLCOMMERZ_VALIDATION_URL = isSandbox
  ? 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
  : 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php';

/**
 * Creates a hosted payment session with SSLCommerz.
 * @param {Object} order - The database order object
 * @param {Object} [customerInfo] - Optional customer details (name, email, phone)
 * @returns {Promise<{success: boolean, redirectUrl: string, sessionKey: string, raw: Object}>}
 */
async function createPaymentSession(order, customerInfo = {}) {
  const storeId = process.env.GATEWAY_STORE_ID;
  const storePassword = process.env.GATEWAY_STORE_PASSWORD;
  const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:5000';

  if (!storeId || !storePassword) {
    throw new Error('GATEWAY_STORE_ID or GATEWAY_STORE_PASSWORD is not configured in .env');
  }

  const successUrl = `${appBaseUrl}/payment/success?tran_id=${order.gatewayTransactionId}&order_id=${order.orderId}`;
  const failUrl = `${appBaseUrl}/payment/fail?tran_id=${order.gatewayTransactionId}&order_id=${order.orderId}`;
  const cancelUrl = `${appBaseUrl}/payment/cancel?tran_id=${order.gatewayTransactionId}&order_id=${order.orderId}`;
  const ipnUrl = `${appBaseUrl}/webhook/payment-ipn`;

  const postData = {
    store_id: storeId,
    store_passwd: storePassword,
    total_amount: Number(order.amount).toFixed(2),
    currency: order.currency || 'BDT',
    tran_id: order.gatewayTransactionId,
    success_url: successUrl,
    fail_url: failUrl,
    cancel_url: cancelUrl,
    ipn_url: ipnUrl,
    shipping_method: 'NO',
    product_name: order.productName || 'Proxy Package',
    product_category: 'Digital Proxy',
    product_profile: 'non-physical-goods',
    cus_name: customerInfo.name || order.telegramUsername || `User_${order.telegramId}`,
    cus_email: customerInfo.email || 'customer@telegramproxy.store',
    cus_add1: 'Online',
    cus_city: 'Dhaka',
    cus_country: 'Bangladesh',
    cus_phone: customerInfo.phone || '01700000000',
    value_a: order.orderId,
    value_b: String(order.telegramId),
  };

  try {
    const response = await axios.post(
      SSLCOMMERZ_INIT_URL,
      querystring.stringify(postData),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 15000,
      }
    );

    const data = response.data;

    if (data && (data.status === 'SUCCESS' || data.GatewayPageURL)) {
      return {
        success: true,
        redirectUrl: data.GatewayPageURL,
        sessionKey: data.sessionkey,
        raw: data,
      };
    } else {
      const errorMsg = data?.failedreason || data?.status || 'Failed to initiate payment session';
      return {
        success: false,
        error: errorMsg,
        raw: data,
      };
    }
  } catch (err) {
    console.error('[PaymentService] Initiation error:', err.response?.data || err.message);
    throw new Error(`SSLCommerz Gateway Error: ${err.response?.data?.failedreason || err.message}`);
  }
}

/**
 * Verifies payment authenticity via SSLCommerz validation API.
 * Never trusts incoming webhook payloads without server-to-server verification.
 * @param {Object} payload - IPN or webhook payload containing val_id & tran_id
 * @returns {Promise<{verified: boolean, tranId?: string, amount?: number, currency?: string, raw?: Object, error?: string}>}
 */
async function verifyPayment(payload) {
  const storeId = process.env.GATEWAY_STORE_ID;
  const storePassword = process.env.GATEWAY_STORE_PASSWORD;

  const valId = payload.val_id || payload.valid;
  const tranId = payload.tran_id;

  if (!valId) {
    return {
      verified: false,
      error: 'Missing val_id in payment payload',
    };
  }

  // Development sandbox fallback if mock testing without real gateway network
  if (process.env.MOCK_PAYMENT === 'true') {
    return {
      verified: true,
      tranId: tranId,
      amount: parseFloat(payload.amount),
      currency: payload.currency || 'BDT',
      cardType: 'MOCK_TEST',
      raw: payload,
    };
  }

  try {
    const validationUrl = `${SSLCOMMERZ_VALIDATION_URL}?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&v=1&format=json`;

    const response = await axios.get(validationUrl, { timeout: 15000 });
    const data = response.data;

    // SSLCommerz returns status "VALID" or "VALIDATED"
    const isValid = data && (data.status === 'VALID' || data.status === 'VALIDATED');

    if (isValid) {
      return {
        verified: true,
        tranId: data.tran_id,
        valId: data.val_id,
        amount: parseFloat(data.amount),
        currency: data.currency,
        cardType: data.card_type,
        bankTranId: data.bank_tran_id,
        cardIssuer: data.card_issuer,
        raw: data,
      };
    } else {
      return {
        verified: false,
        error: data?.error || data?.status || 'Validation failed on gateway server',
        raw: data,
      };
    }
  } catch (err) {
    console.error('[PaymentService] Validation error:', err.response?.data || err.message);
    return {
      verified: false,
      error: `SSLCommerz Validation API error: ${err.message}`,
    };
  }
}

module.exports = {
  createPaymentSession,
  verifyPayment,
  isSandbox,
};
