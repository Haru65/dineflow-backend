const express = require('express');
const router = express.Router();
const { generateId, errorResponse, successResponse } = require('../utils/helpers');
const PaytmService = require('../utils/paytmService');
const OrderRepository = require('../repositories/OrderRepository');
const OrderItemRepository = require('../repositories/OrderItemRepository');
const TenantRepository = require('../repositories/TenantRepository');
const RestaurantTableRepository = require('../repositories/RestaurantTableRepository');
const PaymentProviderRepository = require('../repositories/PaymentProviderRepository');
const EmailService = require('../utils/emailService');

/**
 * Create Paytm transaction token (New CheckoutJS method)
 * POST /api/paytm/create-transaction
 * Body: { orderId, amount, restaurantSlug, customerEmail, customerPhone }
 */
router.post('/create-transaction', async (req, res) => {
  const requestId = 'txn_' + Date.now();
  
  try {
    console.log(`\n🚀 [${requestId}] PAYTM CREATE-TRANSACTION STARTED`);
    console.log(`📋 [${requestId}] REQUEST DETAILS:`);
    console.log(`   Method: ${req.method}`);
    console.log(`   URL: ${req.originalUrl}`);
    console.log(`   Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`   Body:`, JSON.stringify(req.body, null, 2));
    console.log(`   Content-Type: ${req.get('Content-Type')}`);
    console.log(`   User-Agent: ${req.get('User-Agent')}`);

    const { orderId, amount, restaurantSlug, customerEmail, customerPhone } = req.body;

    // Enhanced validation with detailed logging
    console.log(`\n🔍 [${requestId}] VALIDATION CHECK:`);
    console.log(`   orderId: "${orderId}" (type: ${typeof orderId})`);
    console.log(`   amount: "${amount}" (type: ${typeof amount})`);
    console.log(`   restaurantSlug: "${restaurantSlug}" (type: ${typeof restaurantSlug})`);
    console.log(`   customerEmail: "${customerEmail}" (type: ${typeof customerEmail})`);
    console.log(`   customerPhone: "${customerPhone}" (type: ${typeof customerPhone})`);

    if (!orderId) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing orderId`);
      return errorResponse(res, 400, 'Order ID is required');
    }

    if (!amount) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing amount`);
      return errorResponse(res, 400, 'Amount is required');
    }

    if (!restaurantSlug) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing restaurantSlug`);
      return errorResponse(res, 400, 'Restaurant slug is required');
    }

    // Validate amount is a valid number
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Invalid amount: ${amount}`);
      return errorResponse(res, 400, 'Amount must be a valid positive number');
    }

    console.log(`✅ [${requestId}] VALIDATION PASSED - Processing payment request`);
      console.error('❌ VALIDATION FAILED: Invalid amount:', amount);
      return errorResponse(res, 400, 'Amount must be a valid positive number');
    }

    console.log('✅ VALIDATION PASSED - Processing payment request');

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

    // Get Paytm payment config from database (configured via admin panel)
    const paymentConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paymentConfig) {
      console.error('No Paytm configuration found for tenant:', tenant.id);
      return errorResponse(res, 400, 'Paytm payment not configured. Please configure Paytm in the admin panel under Payments section.');
    }

    // Validate Paytm credentials
    if (!paymentConfig.key_id || !paymentConfig.key_secret) {
      console.error('Invalid Paytm configuration for tenant:', tenant.id, {
        hasKeyId: !!paymentConfig.key_id,
        hasKeySecret: !!paymentConfig.key_secret
      });
      return errorResponse(res, 400, 'Invalid Paytm configuration. Please check your Paytm credentials in the admin panel.');
    }

    console.log('Using Paytm config from database:', {
      tenantId: tenant.id,
      merchantId: paymentConfig.key_id,
      website: paymentConfig.website || 'WEBSTAGING',
      configId: paymentConfig.id
    });

    // Generate callback URL
    const callbackUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/paytm/callback`;

    // Create transaction token
    const tokenResponse = await PaytmService.createTransactionToken(
      {
        merchantId: paymentConfig.key_id,
        merchantKey: paymentConfig.key_secret,
        website: paymentConfig.website || 'WEBSTAGING',
        callbackUrl
      },
      {
        orderId: orderId,
        amount: parseFloat(amount),
        customerId: order.table_id || 'guest'
      }
    );

    if (!tokenResponse.body || !tokenResponse.body.txnToken) {
      console.error('Paytm token response:', tokenResponse);
      return errorResponse(res, 500, 'Failed to create transaction token. Please check your Paytm configuration.');
    }

    // Update order with payment provider info
    await OrderRepository.updateById(orderId, {
      payment_provider: 'paytm',
      payment_order_id: orderId
    });

    // Return transaction token for CheckoutJS
    successResponse(res, 201, {
      orderId: orderId,
      amount: parseFloat(amount),
      txnToken: tokenResponse.body.txnToken,
      merchantId: paymentConfig.key_id,
      website: paymentConfig.website || 'WEBSTAGING'
    });
  } catch (error) {
    console.error('Create Paytm transaction error:', error);
    console.error('Error stack:', error.stack);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Create Paytm payment order (Legacy UPI method)
 * POST /api/paytm/create-order
 * Body: { orderId, restaurantSlug, customerEmail, customerPhone }
 */
router.post('/create-order', async (req, res) => {
  try {
    const { orderId, restaurantSlug, customerEmail, customerPhone } = req.body;

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

    // Get Paytm payment config
    const paymentConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paymentConfig) {
      return errorResponse(res, 400, 'Paytm payment not configured for this restaurant');
    }

    // Validate Paytm credentials
    if (!paymentConfig.key_id || !paymentConfig.key_secret) {
      return errorResponse(res, 400, 'Invalid Paytm configuration');
    }

    // Generate callback URL
    const callbackUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/paytm/callback`;

    // Create UPI payment data
    const upiPaymentData = await PaytmService.createUpiPaymentData(
      {
        merchantId: paymentConfig.key_id,
        merchantKey: paymentConfig.key_secret,
        website: 'WEBSTAGING',
        channelId: 'WEB',
        industryType: 'Retail'
      },
      {
        orderId: orderId,
        amount: order.total_amount.toString(),
        customerId: order.table_id || 'guest',
        customerEmail: customerEmail || 'customer@dineflow.com',
        customerPhone: customerPhone || '9999999999',
        callbackUrl
      }
    );

    // Update order with payment provider info
    await OrderRepository.updateById(orderId, {
      payment_provider: 'paytm',
      payment_order_id: orderId
    });

    // Return UPI payment data for QR code and direct UPI payments
    successResponse(res, 201, {
      orderId: orderId,
      amount: order.total_amount,
      currency: 'INR',
      merchantUpiId: upiPaymentData.merchantUpiId,
      merchantName: upiPaymentData.merchantName,
      qrCodeUrl: upiPaymentData.qrCodeData,
      upiString: upiPaymentData.upiString,
      // Keep original params for fallback redirect
      paymentParams: upiPaymentData.paymentParams,
      gatewayUrl: PaytmService.getGatewayUrl('staging')
    });
  } catch (error) {
    console.error('Create Paytm order error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Paytm payment callback
 * POST /api/paytm/callback
 */
router.post('/callback', async (req, res) => {
  try {
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

    // Get Paytm payment config
    const paymentConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paymentConfig) {
      return errorResponse(res, 400, 'Paytm payment not configured');
    }

    // Verify checksum using new method
    const verificationResult = await PaytmService.verifyPaymentCallback(response, paymentConfig.key_secret);

    if (!verificationResult.isValid) {
      console.error('Invalid checksum for order:', ORDERID);
      return errorResponse(res, 400, 'Invalid payment signature');
    }

    // Update order based on payment status
    const paymentStatus = verificationResult.status === 'TXN_SUCCESS' ? 'completed' : 'failed';
    const orderStatus = verificationResult.status === 'TXN_SUCCESS' ? 'confirmed' : 'cancelled';

    await OrderRepository.updateById(ORDERID, {
      payment_status: paymentStatus,
      status: orderStatus,
      payment_id: verificationResult.transactionId,
      payment_order_id: verificationResult.orderId
    });

    // Send kitchen notification if payment successful
    if (paymentStatus === 'completed') {
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
        
        io.to(`kitchen-${tenant.id}`).emit('kitchen-order', {
          orderId: ORDERID,
          tableId: order.table_id,
          tableName: table?.name || 'Unknown',
          items: orderItems,
          createdAt: order.created_at
        });
      }

      // Send confirmation email
      EmailService.sendPaymentConfirmation(
        tenant.id,
        order,
        verificationResult.transactionId,
        tenant.name
      ).catch(err => console.error('Email send failed:', err));
    }

    // Return success response
    successResponse(res, 200, {
      orderId: ORDERID,
      transactionId: verificationResult.transactionId,
      status: verificationResult.status,
      paymentStatus,
      message: verificationResult.responseMessage
    });
  } catch (error) {
    console.error('Paytm callback error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Check payment status
 * GET /api/paytm/status/:orderId
 */
router.get('/status/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    // Get order
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    // Get tenant
    const tenant = await TenantRepository.findById(order.tenant_id);
    if (!tenant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Get Paytm payment config
    const paymentConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paymentConfig) {
      return errorResponse(res, 400, 'Paytm payment not configured');
    }

    // Check transaction status with Paytm
    try {
      const statusResponse = await PaytmService.checkTransactionStatus(
        {
          merchantId: paymentConfig.key_id,
          merchantKey: paymentConfig.key_secret
        },
        orderId
      );

      successResponse(res, 200, {
        orderId,
        status: statusResponse.body?.resultInfo?.resultStatus,
        transactionId: statusResponse.body?.txnId,
        amount: statusResponse.body?.txnAmount,
        responseCode: statusResponse.body?.resultInfo?.resultCode,
        responseMessage: statusResponse.body?.resultInfo?.resultMsg
      });
    } catch (paytmError) {
      console.error('Paytm status check error:', paytmError);
      // Return local order status if Paytm check fails
      successResponse(res, 200, {
        orderId,
        paymentStatus: order.payment_status,
        orderStatus: order.status,
        amount: order.total_amount
      });
    }
  } catch (error) {
    console.error('Check payment status error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Verify payment (alternative endpoint for frontend verification)
 * POST /api/paytm/verify
 */
router.post('/verify', async (req, res) => {
  try {
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

    // Return current payment status
    successResponse(res, 200, {
      orderId,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
      amount: order.total_amount,
      transactionId: order.payment_id,
      isPaid: order.payment_status === 'completed'
    });
  } catch (error) {
    console.error('Verify payment error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

module.exports = router;
