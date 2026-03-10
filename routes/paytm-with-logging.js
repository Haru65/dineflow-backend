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
 * PAYTM ROUTES WITH COMPREHENSIVE LOGGING FOR RENDER
 * 
 * This version includes detailed logging that will show up in Render logs
 * so you can debug without SSH access
 */

/**
 * Create Paytm transaction token (CheckoutJS method)
 * POST /api/paytm/create-transaction
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

    // Get order from database
    console.log(`\n🔍 [${requestId}] FETCHING ORDER: ${orderId}`);
    const order = await OrderRepository.findById(orderId);
    
    if (!order) {
      console.error(`❌ [${requestId}] ORDER NOT FOUND: ${orderId}`);
      return errorResponse(res, 404, 'Order not found');
    }

    console.log(`✅ [${requestId}] ORDER FOUND:`, {
      id: order.id,
      tenantId: order.tenant_id,
      status: order.status,
      totalAmount: order.total_amount,
      paymentStatus: order.payment_status,
      tableId: order.table_id
    });

    // Get tenant from database
    console.log(`\n🔍 [${requestId}] FETCHING TENANT: ${restaurantSlug}`);
    const tenant = await TenantRepository.findBySlug(restaurantSlug);
    
    if (!tenant) {
      console.error(`❌ [${requestId}] TENANT NOT FOUND: ${restaurantSlug}`);
      return errorResponse(res, 404, 'Restaurant not found');
    }

    if (tenant.id !== order.tenant_id) {
      console.error(`❌ [${requestId}] TENANT MISMATCH:`, {
        tenantId: tenant.id,
        orderTenantId: order.tenant_id
      });
      return errorResponse(res, 404, 'Order does not belong to this restaurant');
    }

    console.log(`✅ [${requestId}] TENANT FOUND:`, {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug
    });

    // Get Paytm configuration from admin panel
    console.log(`\n🔍 [${requestId}] FETCHING PAYTM CONFIG for tenant: ${tenant.id}`);
    const paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    
    if (!paytmConfig) {
      console.error(`❌ [${requestId}] PAYTM CONFIG NOT FOUND for tenant: ${tenant.id}`);
      return errorResponse(res, 400, 'Paytm payment not configured. Please configure Paytm in the admin panel under Payments section.');
    }

    console.log(`✅ [${requestId}] PAYTM CONFIG FOUND:`, {
      id: paytmConfig.id,
      merchantId: paytmConfig.key_id,
      website: paytmConfig.website,
      hasSecret: !!paytmConfig.key_secret,
      isActive: paytmConfig.is_active
    });

    // Validate Paytm credentials
    if (!paytmConfig.key_id || !paytmConfig.key_secret) {
      console.error(`❌ [${requestId}] INVALID PAYTM CONFIG:`, {
        hasKeyId: !!paytmConfig.key_id,
        hasKeySecret: !!paytmConfig.key_secret
      });
      return errorResponse(res, 400, 'Invalid Paytm configuration. Please check your Paytm credentials in the admin panel.');
    }

    console.log(`\n🔧 [${requestId}] CREATING PAYTM TRANSACTION TOKEN:`);
    console.log(`   Merchant ID: ${paytmConfig.key_id}`);
    console.log(`   Website: ${paytmConfig.website || 'WEBSTAGING'}`);
    console.log(`   Order ID: ${orderId}`);
    console.log(`   Amount: ${numericAmount}`);

    // Generate callback URL
    const callbackUrl = `${process.env.BASE_URL || 'https://dineflow-backend-hya7.onrender.com'}/api/paytm/callback`;
    console.log(`   Callback URL: ${callbackUrl}`);

    // Create transaction token using CORRECT staging API
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

      console.log(`📡 [${requestId}] PAYTM API RESPONSE:`, JSON.stringify(tokenResponse, null, 2));

      if (!tokenResponse.body || !tokenResponse.body.txnToken) {
        console.error(`❌ [${requestId}] INVALID PAYTM TOKEN RESPONSE:`, tokenResponse);
        return errorResponse(res, 500, 'Failed to create transaction token. Please check your Paytm configuration.');
      }

      // Update order with payment provider info
      console.log(`\n💾 [${requestId}] UPDATING ORDER with payment info`);
      await OrderRepository.updateById(orderId, {
        payment_provider: 'paytm',
        payment_order_id: orderId
      });

      // Return transaction token for CheckoutJS
      const response = {
        orderId: orderId,
        amount: numericAmount,
        txnToken: tokenResponse.body.txnToken,
        merchantId: paytmConfig.key_id,
        website: paytmConfig.website || 'WEBSTAGING',
        currency: 'INR',
        restaurantName: tenant.name
      };

      console.log(`✅ [${requestId}] TRANSACTION TOKEN CREATED SUCCESSFULLY`);
      console.log(`📤 [${requestId}] RESPONSE:`, JSON.stringify(response, null, 2));

      successResponse(res, 201, response, 'Transaction token created successfully');

    } catch (paytmError) {
      console.error(`❌ [${requestId}] PAYTM API ERROR:`, paytmError);
      console.error(`❌ [${requestId}] PAYTM ERROR STACK:`, paytmError.stack);
      return errorResponse(res, 500, 'Paytm API error: ' + paytmError.message);
    }

  } catch (error) {
    console.error(`❌ [${requestId}] GENERAL ERROR:`, error);
    console.error(`❌ [${requestId}] ERROR STACK:`, error.stack);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Create Paytm UPI payment order
 * POST /api/paytm/create-order
 */
router.post('/create-order', async (req, res) => {
  const requestId = 'ord_' + Date.now();
  
  try {
    console.log(`\n🚀 [${requestId}] PAYTM CREATE-ORDER STARTED`);
    console.log(`📋 [${requestId}] REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    const { orderId, restaurantSlug, customerEmail, customerPhone } = req.body;

    // Validation with detailed logging
    console.log(`\n🔍 [${requestId}] VALIDATION CHECK:`);
    console.log(`   orderId: "${orderId}" (type: ${typeof orderId})`);
    console.log(`   restaurantSlug: "${restaurantSlug}" (type: ${typeof restaurantSlug})`);

    if (!orderId) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing orderId`);
      return errorResponse(res, 400, 'Order ID is required');
    }

    if (!restaurantSlug) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing restaurantSlug`);
      return errorResponse(res, 400, 'Restaurant slug is required');
    }

    console.log(`✅ [${requestId}] VALIDATION PASSED`);

    // Get order
    console.log(`\n🔍 [${requestId}] FETCHING ORDER: ${orderId}`);
    const order = await OrderRepository.findById(orderId);
    if (!order) {
      console.error(`❌ [${requestId}] ORDER NOT FOUND: ${orderId}`);
      return errorResponse(res, 404, 'Order not found');
    }

    console.log(`✅ [${requestId}] ORDER FOUND:`, {
      id: order.id,
      tenantId: order.tenant_id,
      totalAmount: order.total_amount
    });

    // Get tenant
    console.log(`\n🔍 [${requestId}] FETCHING TENANT: ${restaurantSlug}`);
    const tenant = await TenantRepository.findBySlug(restaurantSlug);
    if (!tenant || tenant.id !== order.tenant_id) {
      console.error(`❌ [${requestId}] TENANT NOT FOUND OR MISMATCH`);
      return errorResponse(res, 404, 'Restaurant not found or order mismatch');
    }

    console.log(`✅ [${requestId}] TENANT FOUND: ${tenant.name}`);

    // Get Paytm config
    console.log(`\n🔍 [${requestId}] FETCHING PAYTM CONFIG`);
    const paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paytmConfig) {
      console.error(`❌ [${requestId}] PAYTM CONFIG NOT FOUND`);
      return errorResponse(res, 400, 'Paytm payment not configured for this restaurant');
    }

    if (!paytmConfig.key_id || !paytmConfig.key_secret) {
      console.error(`❌ [${requestId}] INVALID PAYTM CONFIG`);
      return errorResponse(res, 400, 'Invalid Paytm configuration');
    }

    console.log(`✅ [${requestId}] PAYTM CONFIG VALID`);

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

    console.log(`✅ [${requestId}] UPI PAYMENT CREATED SUCCESSFULLY`);
    console.log(`📤 [${requestId}] RESPONSE:`, JSON.stringify(response, null, 2));

    successResponse(res, 201, response, 'UPI payment created successfully');

  } catch (error) {
    console.error(`❌ [${requestId}] ERROR:`, error);
    console.error(`❌ [${requestId}] ERROR STACK:`, error.stack);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Verify payment status
 * POST /api/paytm/verify
 */
router.post('/verify', async (req, res) => {
  const requestId = 'ver_' + Date.now();
  
  try {
    console.log(`\n🚀 [${requestId}] PAYTM VERIFY STARTED`);
    console.log(`📋 [${requestId}] REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    const { orderId, restaurantSlug } = req.body;

    if (!orderId || !restaurantSlug) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing orderId or restaurantSlug`);
      return errorResponse(res, 400, 'Order ID and restaurant slug are required');
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
      console.error(`❌ [${requestId}] TENANT NOT FOUND OR MISMATCH`);
      return errorResponse(res, 404, 'Restaurant not found or order mismatch');
    }

    // Return current payment status
    const response = {
      orderId,
      paymentStatus: order.payment_status,
      orderStatus: order.status,
      amount: order.total_amount,
      transactionId: order.payment_id,
      isPaid: order.payment_status === 'completed'
    };

    console.log(`✅ [${requestId}] VERIFY SUCCESSFUL`);
    console.log(`📤 [${requestId}] RESPONSE:`, JSON.stringify(response, null, 2));

    successResponse(res, 200, response);

  } catch (error) {
    console.error(`❌ [${requestId}] ERROR:`, error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Paytm payment callback
 * POST /api/paytm/callback
 */
router.post('/callback', async (req, res) => {
  const requestId = 'cb_' + Date.now();
  
  try {
    console.log(`\n🚀 [${requestId}] PAYTM CALLBACK STARTED`);
    console.log(`📋 [${requestId}] CALLBACK DATA:`, JSON.stringify(req.body, null, 2));

    const response = req.body;
    const { ORDERID, CHECKSUMHASH } = response;

    if (!ORDERID || !CHECKSUMHASH) {
      console.error(`❌ [${requestId}] INVALID CALLBACK DATA`);
      return errorResponse(res, 400, 'Invalid callback data');
    }

    // Get order
    const order = await OrderRepository.findById(ORDERID);
    if (!order) {
      console.error(`❌ [${requestId}] ORDER NOT FOUND: ${ORDERID}`);
      return errorResponse(res, 404, 'Order not found');
    }

    // Get tenant
    const tenant = await TenantRepository.findById(order.tenant_id);
    if (!tenant) {
      console.error(`❌ [${requestId}] TENANT NOT FOUND`);
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Get Paytm payment config
    const paymentConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paymentConfig) {
      console.error(`❌ [${requestId}] PAYTM CONFIG NOT FOUND`);
      return errorResponse(res, 400, 'Paytm payment not configured');
    }

    // Verify checksum
    const verificationResult = await PaytmService.verifyPaymentCallback(response, paymentConfig.key_secret);

    if (!verificationResult.isValid) {
      console.error(`❌ [${requestId}] INVALID CHECKSUM for order: ${ORDERID}`);
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

    console.log(`✅ [${requestId}] CALLBACK PROCESSED SUCCESSFULLY`);

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
        console.error(`⚠️ [${requestId}] KITCHEN NOTIFICATION ERROR:`, notificationError);
      }
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
    console.error(`❌ [${requestId}] CALLBACK ERROR:`, error);
    console.error(`❌ [${requestId}] ERROR STACK:`, error.stack);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

module.exports = router;