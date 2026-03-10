const express = require('express');
const router = express.Router();
const { generateId, errorResponse, successResponse } = require('../utils/helpers');
const PaytmService = require('../utils/paytmService');
const OrderRepository = require('../repositories/OrderRepository');
const OrderItemRepository = require('../repositories/OrderItemRepository');
const TenantRepository = require('../repositories/TenantRepository');
const RestaurantTableRepository = require('../repositories/RestaurantTableRepository');
const PaymentProviderRepository = require('../repositories/PaymentProviderRepository');

/**
 * PRODUCTION PAYTM PAYMENT ROUTES
 * Single, clean, production-ready implementation
 */

/**
 * Create Paytm transaction token (CheckoutJS method)
 * POST /api/paytm/create-transaction
 */
router.post('/create-transaction', async (req, res) => {
  const requestId = 'txn_' + Date.now();
  
  try {
    console.log(`🚀 [${requestId}] PAYTM CREATE-TRANSACTION STARTED`);
    console.log(`📋 [${requestId}] REQUEST:`, JSON.stringify(req.body, null, 2));

    const { orderId, amount, restaurantSlug, customerEmail, customerPhone } = req.body;

    // Validation
    if (!orderId || !amount || !restaurantSlug) {
      const missing = [];
      if (!orderId) missing.push('orderId');
      if (!amount) missing.push('amount');
      if (!restaurantSlug) missing.push('restaurantSlug');
      
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing ${missing.join(', ')}`);
      return errorResponse(res, 400, `Missing required fields: ${missing.join(', ')}`);
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error(`❌ [${requestId}] INVALID AMOUNT: ${amount}`);
      return errorResponse(res, 400, 'Amount must be a valid positive number');
    }

    // Get order
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      console.error(`❌ [${requestId}] ORDER NOT FOUND: ${orderId}`);
      return errorResponse(res, 404, 'Order not found');
    }

    // Get tenant
    const tenant = await TenantRepository.findBySlug(restaurantSlug);
    if (!tenant || tenant.id !== order.tenant_id) {
      console.error(`❌ [${requestId}] TENANT MISMATCH`);
      return errorResponse(res, 404, 'Restaurant not found or order mismatch');
    }

    // Get Paytm config
    const paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paytmConfig || !paytmConfig.key_id || !paytmConfig.key_secret) {
      console.error(`❌ [${requestId}] PAYTM CONFIG INVALID`);
      return errorResponse(res, 400, 'Paytm payment not configured');
    }

    if (!paytmConfig.is_active) {
      console.error(`❌ [${requestId}] PAYTM CONFIG INACTIVE`);
      return errorResponse(res, 400, 'Paytm payment is currently disabled');
    }

    // Validate merchant key length (Paytm keys should be 32 characters)
    if (paytmConfig.key_secret.length < 16) {
      console.error(`❌ [${requestId}] INVALID KEY LENGTH: ${paytmConfig.key_secret.length} chars`);
      return errorResponse(res, 400, 'Invalid Paytm merchant key. Please check your configuration.');
    }

    console.log(`✅ [${requestId}] CONFIG VALID - MID: ${paytmConfig.key_id}, Key Length: ${paytmConfig.key_secret.length}`);

    // Create transaction token
    const callbackUrl = `${process.env.BASE_URL || 'https://dineflow-backend-hya7.onrender.com'}/api/paytm/callback`;
    
    try {
      const tokenResponse = await PaytmService.createTransactionToken(
        {
          merchantId: paytmConfig.key_id,
          merchantKey: paytmConfig.key_secret,
          website: paytmConfig.website || 'WEBSTAGING',
          callbackUrl
        },
        {
          orderId: orderId,
          amount: numericAmount,
          customerId: order.table_id || 'guest'
        }
      );

      console.log(`📡 [${requestId}] PAYTM RESPONSE:`, tokenResponse?.body?.resultInfo?.resultStatus);

      if (!tokenResponse?.body?.txnToken) {
        console.error(`❌ [${requestId}] NO TOKEN IN RESPONSE:`, tokenResponse);
        return errorResponse(res, 500, 'Failed to create transaction token');
      }

      // Update order
      await OrderRepository.updateById(orderId, {
        payment_provider: 'paytm',
        payment_order_id: orderId
      });

      const response = {
        orderId: orderId,
        amount: numericAmount,
        txnToken: tokenResponse.body.txnToken,
        merchantId: paytmConfig.key_id,
        website: paytmConfig.website || 'WEBSTAGING',
        currency: 'INR',
        restaurantName: tenant.name
      };

      console.log(`✅ [${requestId}] SUCCESS`);
      return successResponse(res, 201, response, 'Transaction token created successfully');

    } catch (paytmError) {
      console.error(`❌ [${requestId}] PAYTM API ERROR:`, paytmError.message);
      
      // Check if it's a key validation error
      if (paytmError.message.includes('Invalid key length') || paytmError.message.includes('key')) {
        return errorResponse(res, 400, 'Invalid Paytm merchant key configuration. Please verify your Paytm credentials in admin panel.');
      }
      
      return errorResponse(res, 500, 'Paytm service temporarily unavailable');
    }

  } catch (error) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return errorResponse(res, 500, 'Internal server error');
  }
});

/**
 * Create Paytm UPI payment order
 * POST /api/paytm/create-order
 */
router.post('/create-order', async (req, res) => {
  const requestId = 'ord_' + Date.now();
  
  try {
    console.log(`🚀 [${requestId}] PAYTM CREATE-ORDER STARTED`);
    console.log(`📋 [${requestId}] REQUEST:`, JSON.stringify(req.body, null, 2));

    const { orderId, restaurantSlug, customerEmail, customerPhone } = req.body;

    // Validation
    if (!orderId || !restaurantSlug) {
      const missing = [];
      if (!orderId) missing.push('orderId');
      if (!restaurantSlug) missing.push('restaurantSlug');
      
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing ${missing.join(', ')}`);
      return errorResponse(res, 400, `Missing required fields: ${missing.join(', ')}`);
    }

    // Get order
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      console.error(`❌ [${requestId}] ORDER NOT FOUND: ${orderId}`);
      return errorResponse(res, 404, 'Order not found');
    }

    // Get tenant
    const tenant = await TenantRepository.findBySlug(restaurantSlug);
    if (!tenant || tenant.id !== order.tenant_id) {
      console.error(`❌ [${requestId}] TENANT MISMATCH`);
      return errorResponse(res, 404, 'Restaurant not found or order mismatch');
    }

    // Get Paytm config
    const paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paytmConfig || !paytmConfig.key_id || !paytmConfig.key_secret) {
      console.error(`❌ [${requestId}] PAYTM CONFIG INVALID`);
      return errorResponse(res, 400, 'Paytm payment not configured');
    }

    if (!paytmConfig.is_active) {
      console.error(`❌ [${requestId}] PAYTM CONFIG INACTIVE`);
      return errorResponse(res, 400, 'Paytm payment is currently disabled');
    }

    console.log(`✅ [${requestId}] CONFIG VALID`);

    // Create UPI payment data
    const merchantUpiId = `${paytmConfig.key_id}@paytm`;
    const upiString = `upi://pay?pa=${merchantUpiId}&pn=${encodeURIComponent(tenant.name)}&am=${order.total_amount}&cu=INR&tn=Order%20${orderId}`;
    
    // Update order
    await OrderRepository.updateById(orderId, {
      payment_provider: 'paytm',
      payment_order_id: orderId
    });

    const response = {
      orderId: orderId,
      amount: order.total_amount,
      currency: 'INR',
      merchantUpiId: merchantUpiId,
      merchantName: tenant.name,
      upiString: upiString,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`
    };

    console.log(`✅ [${requestId}] UPI PAYMENT CREATED`);
    return successResponse(res, 201, response, 'UPI payment created successfully');

  } catch (error) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return errorResponse(res, 500, 'Internal server error');
  }
});

/**
 * Verify payment status (with rate limiting)
 * POST /api/paytm/verify
 */
router.post('/verify', async (req, res) => {
  const requestId = 'ver_' + Date.now();
  const clientIp = req.ip || req.connection.remoteAddress;
  
  try {
    // Simple rate limiting - max 1 request per second per IP
    const now = Date.now();
    const rateLimitKey = `verify_${clientIp}`;
    
    if (!global.rateLimitCache) {
      global.rateLimitCache = new Map();
    }
    
    const lastRequest = global.rateLimitCache.get(rateLimitKey);
    if (lastRequest && (now - lastRequest) < 1000) {
      return errorResponse(res, 429, 'Too many requests. Please wait before checking again.');
    }
    
    global.rateLimitCache.set(rateLimitKey, now);
    
    // Clean up old entries every 100 requests
    if (global.rateLimitCache.size > 100) {
      const cutoff = now - 60000; // 1 minute ago
      for (const [key, timestamp] of global.rateLimitCache.entries()) {
        if (timestamp < cutoff) {
          global.rateLimitCache.delete(key);
        }
      }
    }

    const { orderId, restaurantSlug } = req.body;

    if (!orderId || !restaurantSlug) {
      return errorResponse(res, 400, 'Order ID and restaurant slug are required');
    }

    // Get order
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Get tenant
    const tenant = await TenantRepository.findBySlug(restaurantSlug);
    if (!tenant || tenant.id !== order.tenant_id) {
      return errorResponse(res, 404, 'Restaurant not found or order mismatch');
    }

    const response = {
      orderId,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
      amount: order.total_amount,
      transactionId: order.payment_id,
      isPaid: order.payment_status === 'completed'
    };

    // Only log successful payments to reduce noise
    if (response.isPaid) {
      console.log(`✅ [${requestId}] PAYMENT COMPLETED: ${orderId}`);
    }
    
    return successResponse(res, 200, response);

  } catch (error) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return errorResponse(res, 500, 'Internal server error');
  }
});

/**
 * Paytm payment callback
 * POST /api/paytm/callback
 */
router.post('/callback', async (req, res) => {
  const requestId = 'cb_' + Date.now();
  
  try {
    console.log(`🚀 [${requestId}] PAYTM CALLBACK`);
    console.log(`📋 [${requestId}] DATA:`, JSON.stringify(req.body, null, 2));

    const response = req.body;
    const { ORDERID, CHECKSUMHASH } = response;

    if (!ORDERID || !CHECKSUMHASH) {
      return errorResponse(res, 400, 'Invalid callback data');
    }

    // Get order
    const order = await OrderRepository.findById(ORDERID);
    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Get tenant
    const tenant = await TenantRepository.findById(order.tenant_id);
    if (!tenant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Get Paytm config
    const paymentConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paymentConfig) {
      return errorResponse(res, 400, 'Paytm payment not configured');
    }

    // Verify checksum
    const verificationResult = await PaytmService.verifyPaymentCallback(response, paymentConfig.key_secret);

    if (!verificationResult.isValid) {
      console.error(`❌ [${requestId}] INVALID CHECKSUM`);
      return errorResponse(res, 400, 'Invalid payment signature');
    }

    // Update order
    const paymentStatus = verificationResult.status === 'TXN_SUCCESS' ? 'completed' : 'failed';
    const orderStatus = verificationResult.status === 'TXN_SUCCESS' ? 'confirmed' : 'cancelled';

    await OrderRepository.updateById(ORDERID, {
      payment_status: paymentStatus,
      status: orderStatus,
      payment_id: verificationResult.transactionId,
      payment_order_id: verificationResult.orderId
    });

    console.log(`✅ [${requestId}] ORDER UPDATED: ${orderStatus}`);

    // Send kitchen notification if payment successful
    if (paymentStatus === 'completed') {
      try {
        const io = req.app?.get('io');
        if (io) {
          const orderItems = await OrderItemRepository.findByOrder(ORDERID);
          const table = await RestaurantTableRepository.findById(order.table_id);
          
          io.to(`tenant-${tenant.id}`).emit('new-order', {
            orderId: ORDERID,
            tableId: order.table_id,
            tableName: table?.name || 'Unknown',
            status: orderStatus,
            totalAmount: order.total_amount,
            items: orderItems.map(item => ({
              name: item.name_snapshot,
              quantity: item.quantity,
              price: item.price_snapshot
            })),
            createdAt: order.created_at
          });
          
          console.log(`✅ [${requestId}] KITCHEN NOTIFICATION SENT`);
        }
      } catch (notificationError) {
        console.error(`⚠️ [${requestId}] NOTIFICATION ERROR:`, notificationError);
      }
    }

    return successResponse(res, 200, {
      orderId: ORDERID,
      transactionId: verificationResult.transactionId,
      status: verificationResult.status,
      paymentStatus,
      message: verificationResult.responseMessage
    });

  } catch (error) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    return errorResponse(res, 500, 'Internal server error');
  }
});

module.exports = router;