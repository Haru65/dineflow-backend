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
 * PRODUCTION-READY PAYTM ROUTES
 * 
 * This version handles all edge cases and provides comprehensive error handling
 * for the production environment on Render.
 */

/**
 * Create Paytm transaction token (CheckoutJS method)
 * POST /api/paytm/create-transaction
 */
router.post('/create-transaction', async (req, res) => {
  const requestId = 'txn_' + Date.now();
  
  try {
    console.log(`\n🚀 [${requestId}] PAYTM CREATE-TRANSACTION STARTED`);
    console.log(`📋 [${requestId}] REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    const { orderId, amount, restaurantSlug, customerEmail, customerPhone } = req.body;

    // Enhanced validation
    if (!orderId || !amount || !restaurantSlug) {
      const missing = [];
      if (!orderId) missing.push('orderId');
      if (!amount) missing.push('amount');
      if (!restaurantSlug) missing.push('restaurantSlug');
      
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing ${missing.join(', ')}`);
      return errorResponse(res, 400, `Missing required fields: ${missing.join(', ')}`);
    }

    // Validate amount is a valid number
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error(`❌ [${requestId}] VALIDATION FAILED: Invalid amount: ${amount}`);
      return errorResponse(res, 400, 'Amount must be a valid positive number');
    }

    console.log(`✅ [${requestId}] VALIDATION PASSED`);

    // Get order from database with error handling
    console.log(`\n🔍 [${requestId}] FETCHING ORDER: ${orderId}`);
    let order;
    try {
      order = await OrderRepository.findById(orderId);
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching order:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching order');
    }
    
    if (!order) {
      console.error(`❌ [${requestId}] ORDER NOT FOUND: ${orderId}`);
      return errorResponse(res, 404, 'Order not found');
    }

    console.log(`✅ [${requestId}] ORDER FOUND: ${order.id} (tenant: ${order.tenant_id})`);

    // Get tenant from database with error handling
    console.log(`\n🔍 [${requestId}] FETCHING TENANT: ${restaurantSlug}`);
    let tenant;
    try {
      tenant = await TenantRepository.findBySlug(restaurantSlug);
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching tenant:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching restaurant');
    }
    
    if (!tenant) {
      console.error(`❌ [${requestId}] TENANT NOT FOUND: ${restaurantSlug}`);
      return errorResponse(res, 404, 'Restaurant not found');
    }

    if (tenant.id !== order.tenant_id) {
      console.error(`❌ [${requestId}] TENANT MISMATCH: ${tenant.id} vs ${order.tenant_id}`);
      return errorResponse(res, 403, 'Order does not belong to this restaurant');
    }

    console.log(`✅ [${requestId}] TENANT FOUND: ${tenant.name}`);

    // Get Paytm configuration with error handling
    console.log(`\n🔍 [${requestId}] FETCHING PAYTM CONFIG`);
    let paytmConfig;
    try {
      paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching Paytm config:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching payment configuration');
    }
    
    if (!paytmConfig) {
      console.error(`❌ [${requestId}] PAYTM CONFIG NOT FOUND for tenant: ${tenant.id}`);
      return errorResponse(res, 400, 'Paytm payment not configured. Please configure Paytm in the admin panel.');
    }

    // Validate Paytm credentials
    if (!paytmConfig.key_id || !paytmConfig.key_secret) {
      console.error(`❌ [${requestId}] INVALID PAYTM CONFIG: missing credentials`);
      return errorResponse(res, 400, 'Invalid Paytm configuration. Please check your Paytm credentials.');
    }

    if (!paytmConfig.is_active) {
      console.error(`❌ [${requestId}] PAYTM CONFIG INACTIVE`);
      return errorResponse(res, 400, 'Paytm payment is currently disabled for this restaurant.');
    }

    console.log(`✅ [${requestId}] PAYTM CONFIG VALID: MID=${paytmConfig.key_id}`);

    // Create transaction token using Paytm API
    console.log(`\n🔧 [${requestId}] CREATING PAYTM TRANSACTION TOKEN`);
    
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

      console.log(`📡 [${requestId}] PAYTM API RESPONSE STATUS:`, tokenResponse?.body?.resultInfo?.resultStatus);

      if (!tokenResponse?.body?.txnToken) {
        console.error(`❌ [${requestId}] INVALID PAYTM TOKEN RESPONSE:`, tokenResponse);
        return errorResponse(res, 500, 'Failed to create transaction token. Please try again.');
      }

      // Update order with payment provider info
      try {
        await OrderRepository.updateById(orderId, {
          payment_provider: 'paytm',
          payment_order_id: orderId
        });
        console.log(`✅ [${requestId}] ORDER UPDATED with payment info`);
      } catch (updateError) {
        console.error(`⚠️ [${requestId}] ORDER UPDATE ERROR:`, updateError);
        // Continue anyway, this is not critical
      }

      // Return success response
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
      return successResponse(res, 201, response, 'Transaction token created successfully');

    } catch (paytmError) {
      console.error(`❌ [${requestId}] PAYTM API ERROR:`, paytmError.message);
      console.error(`❌ [${requestId}] PAYTM ERROR DETAILS:`, paytmError);
      return errorResponse(res, 500, 'Paytm service error. Please try again later.');
    }

  } catch (error) {
    console.error(`❌ [${requestId}] GENERAL ERROR:`, error.message);
    console.error(`❌ [${requestId}] ERROR STACK:`, error.stack);
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
    console.log(`\n🚀 [${requestId}] PAYTM CREATE-ORDER STARTED`);
    console.log(`📋 [${requestId}] REQUEST BODY:`, JSON.stringify(req.body, null, 2));

    const { orderId, restaurantSlug, customerEmail, customerPhone } = req.body;

    // Validation
    if (!orderId || !restaurantSlug) {
      const missing = [];
      if (!orderId) missing.push('orderId');
      if (!restaurantSlug) missing.push('restaurantSlug');
      
      console.error(`❌ [${requestId}] VALIDATION FAILED: Missing ${missing.join(', ')}`);
      return errorResponse(res, 400, `Missing required fields: ${missing.join(', ')}`);
    }

    console.log(`✅ [${requestId}] VALIDATION PASSED`);

    // Get order with error handling
    console.log(`\n🔍 [${requestId}] FETCHING ORDER: ${orderId}`);
    let order;
    try {
      order = await OrderRepository.findById(orderId);
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching order:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching order');
    }
    
    if (!order) {
      console.error(`❌ [${requestId}] ORDER NOT FOUND: ${orderId}`);
      return errorResponse(res, 404, 'Order not found');
    }

    console.log(`✅ [${requestId}] ORDER FOUND: amount=${order.total_amount}`);

    // Get tenant with error handling
    console.log(`\n🔍 [${requestId}] FETCHING TENANT: ${restaurantSlug}`);
    let tenant;
    try {
      tenant = await TenantRepository.findBySlug(restaurantSlug);
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching tenant:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching restaurant');
    }
    
    if (!tenant || tenant.id !== order.tenant_id) {
      console.error(`❌ [${requestId}] TENANT NOT FOUND OR MISMATCH`);
      return errorResponse(res, 404, 'Restaurant not found or order mismatch');
    }

    console.log(`✅ [${requestId}] TENANT FOUND: ${tenant.name}`);

    // Get Paytm config with error handling
    console.log(`\n🔍 [${requestId}] FETCHING PAYTM CONFIG`);
    let paytmConfig;
    try {
      paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching Paytm config:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching payment configuration');
    }
    
    if (!paytmConfig || !paytmConfig.key_id || !paytmConfig.key_secret) {
      console.error(`❌ [${requestId}] PAYTM CONFIG INVALID OR NOT FOUND`);
      return errorResponse(res, 400, 'Paytm payment not configured for this restaurant');
    }

    if (!paytmConfig.is_active) {
      console.error(`❌ [${requestId}] PAYTM CONFIG INACTIVE`);
      return errorResponse(res, 400, 'Paytm payment is currently disabled');
    }

    console.log(`✅ [${requestId}] PAYTM CONFIG VALID`);

    // Create UPI payment data
    const merchantUpiId = `${paytmConfig.key_id}@paytm`;
    const upiString = `upi://pay?pa=${merchantUpiId}&pn=${encodeURIComponent(tenant.name)}&am=${order.total_amount}&cu=INR&tn=Order%20${orderId}`;
    
    // Update order with payment provider info
    try {
      await OrderRepository.updateById(orderId, {
        payment_provider: 'paytm',
        payment_order_id: orderId
      });
      console.log(`✅ [${requestId}] ORDER UPDATED with payment info`);
    } catch (updateError) {
      console.error(`⚠️ [${requestId}] ORDER UPDATE ERROR:`, updateError);
      // Continue anyway, this is not critical
    }

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
    return successResponse(res, 201, response, 'UPI payment created successfully');

  } catch (error) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    console.error(`❌ [${requestId}] ERROR STACK:`, error.stack);
    return errorResponse(res, 500, 'Internal server error');
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

    // Get order with error handling
    let order;
    try {
      order = await OrderRepository.findById(orderId);
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching order:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching order');
    }
    
    if (!order) {
      console.error(`❌ [${requestId}] ORDER NOT FOUND: ${orderId}`);
      return errorResponse(res, 404, 'Order not found');
    }

    // Get tenant with error handling
    let tenant;
    try {
      tenant = await TenantRepository.findBySlug(restaurantSlug);
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching tenant:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching restaurant');
    }
    
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

    console.log(`✅ [${requestId}] VERIFY SUCCESSFUL: isPaid=${response.isPaid}`);
    return successResponse(res, 200, response);

  } catch (error) {
    console.error(`❌ [${requestId}] ERROR:`, error.message);
    console.error(`❌ [${requestId}] ERROR STACK:`, error.stack);
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
    console.log(`\n🚀 [${requestId}] PAYTM CALLBACK STARTED`);
    console.log(`📋 [${requestId}] CALLBACK DATA:`, JSON.stringify(req.body, null, 2));

    const response = req.body;
    const { ORDERID, CHECKSUMHASH } = response;

    if (!ORDERID || !CHECKSUMHASH) {
      console.error(`❌ [${requestId}] INVALID CALLBACK DATA`);
      return errorResponse(res, 400, 'Invalid callback data');
    }

    // Get order with error handling
    let order;
    try {
      order = await OrderRepository.findById(ORDERID);
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching order:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching order');
    }
    
    if (!order) {
      console.error(`❌ [${requestId}] ORDER NOT FOUND: ${ORDERID}`);
      return errorResponse(res, 404, 'Order not found');
    }

    // Get tenant with error handling
    let tenant;
    try {
      tenant = await TenantRepository.findById(order.tenant_id);
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching tenant:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching restaurant');
    }
    
    if (!tenant) {
      console.error(`❌ [${requestId}] TENANT NOT FOUND`);
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Get Paytm payment config with error handling
    let paymentConfig;
    try {
      paymentConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    } catch (dbError) {
      console.error(`❌ [${requestId}] DATABASE ERROR fetching payment config:`, dbError);
      return errorResponse(res, 500, 'Database error while fetching payment configuration');
    }
    
    if (!paymentConfig) {
      console.error(`❌ [${requestId}] PAYTM CONFIG NOT FOUND`);
      return errorResponse(res, 400, 'Paytm payment not configured');
    }

    // Verify checksum
    let verificationResult;
    try {
      verificationResult = await PaytmService.verifyPaymentCallback(response, paymentConfig.key_secret);
    } catch (verifyError) {
      console.error(`❌ [${requestId}] CHECKSUM VERIFICATION ERROR:`, verifyError);
      return errorResponse(res, 500, 'Payment verification failed');
    }

    if (!verificationResult.isValid) {
      console.error(`❌ [${requestId}] INVALID CHECKSUM for order: ${ORDERID}`);
      return errorResponse(res, 400, 'Invalid payment signature');
    }

    // Update order based on payment status
    const paymentStatus = verificationResult.status === 'TXN_SUCCESS' ? 'completed' : 'failed';
    const orderStatus = verificationResult.status === 'TXN_SUCCESS' ? 'confirmed' : 'cancelled';

    try {
      await OrderRepository.updateById(ORDERID, {
        payment_status: paymentStatus,
        status: orderStatus,
        payment_id: verificationResult.transactionId,
        payment_order_id: verificationResult.orderId
      });
      console.log(`✅ [${requestId}] ORDER STATUS UPDATED: ${orderStatus}`);
    } catch (updateError) {
      console.error(`❌ [${requestId}] ORDER UPDATE ERROR:`, updateError);
      return errorResponse(res, 500, 'Failed to update order status');
    }

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
        // Don't fail the callback for notification errors
      }
    }

    // Return success response
    return successResponse(res, 200, {
      orderId: ORDERID,
      transactionId: verificationResult.transactionId,
      status: verificationResult.status,
      paymentStatus,
      message: verificationResult.responseMessage
    });

  } catch (error) {
    console.error(`❌ [${requestId}] CALLBACK ERROR:`, error.message);
    console.error(`❌ [${requestId}] ERROR STACK:`, error.stack);
    return errorResponse(res, 500, 'Internal server error');
  }
});

module.exports = router;