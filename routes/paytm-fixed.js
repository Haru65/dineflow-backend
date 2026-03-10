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
 * FIXED PAYTM INTEGRATION - CORRECT API ENDPOINTS
 * 
 * Uses correct Paytm staging API:
 * https://securegw-stage.paytm.in/theia/api/v1/initiateTransaction
 */

/**
 * Create Paytm transaction token (CheckoutJS method)
 * POST /api/paytm-fixed/create-transaction
 */
router.post('/create-transaction', async (req, res) => {
  try {
    const { orderId, amount, restaurantSlug, customerEmail, customerPhone } = req.body;

    console.log('Creating Paytm transaction:', { orderId, amount, restaurantSlug });

    if (!orderId || !amount || !restaurantSlug) {
      return errorResponse(res, 400, 'Order ID, amount, and restaurant slug are required');
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

    // Get Paytm configuration from admin panel
    const paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paytmConfig) {
      console.error('No Paytm configuration found for tenant:', tenant.id);
      return errorResponse(res, 400, 'Paytm payment not configured. Please configure Paytm in the admin panel under Payments section.');
    }

    // Validate Paytm credentials
    if (!paytmConfig.key_id || !paytmConfig.key_secret) {
      console.error('Invalid Paytm configuration for tenant:', tenant.id);
      return errorResponse(res, 400, 'Invalid Paytm configuration. Please check your Paytm credentials in the admin panel.');
    }

    console.log('Using Paytm config:', {
      merchantId: paytmConfig.key_id,
      website: paytmConfig.website || 'WEBSTAGING',
      tenantId: tenant.id
    });

    // Generate callback URL
    const callbackUrl = `${process.env.BASE_URL || 'https://dineflow-backend-hya7.onrender.com'}/api/paytm-fixed/callback`;

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
          amount: parseFloat(amount),
          customerId: order.table_id || 'guest'
        }
      );

      console.log('Paytm token response:', tokenResponse);

      if (!tokenResponse.body || !tokenResponse.body.txnToken) {
        console.error('Invalid Paytm token response:', tokenResponse);
        return errorResponse(res, 500, 'Failed to create transaction token. Please check your Paytm configuration.');
      }

      // Update order with payment provider info
      await OrderRepository.updateById(orderId, {
        payment_provider: 'paytm',
        payment_order_id: orderId
      });

      // Return transaction token for CheckoutJS
      const response = {
        orderId: orderId,
        amount: parseFloat(amount),
        txnToken: tokenResponse.body.txnToken,
        merchantId: paytmConfig.key_id,
        website: paytmConfig.website || 'WEBSTAGING',
        // Additional data for frontend
        currency: 'INR',
        restaurantName: tenant.name
      };

      console.log('Transaction token created successfully:', {
        orderId,
        merchantId: paytmConfig.key_id,
        hasToken: !!response.txnToken
      });

      successResponse(res, 201, response, 'Transaction token created successfully');

    } catch (paytmError) {
      console.error('Paytm API error:', paytmError);
      return errorResponse(res, 500, 'Paytm API error: ' + paytmError.message);
    }

  } catch (error) {
    console.error('Create Paytm transaction error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Create Paytm UPI payment (Direct UPI method)
 * POST /api/paytm-fixed/create-upi-payment
 */
router.post('/create-upi-payment', async (req, res) => {
  try {
    const { orderId, amount, restaurantSlug } = req.body;

    console.log('Creating Paytm UPI payment:', { orderId, amount, restaurantSlug });

    if (!orderId || !amount || !restaurantSlug) {
      return errorResponse(res, 400, 'Order ID, amount, and restaurant slug are required');
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

    // Get Paytm configuration
    const paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (!paytmConfig) {
      return errorResponse(res, 400, 'Paytm payment not configured for this restaurant');
    }

    if (!paytmConfig.key_id || !paytmConfig.key_secret) {
      return errorResponse(res, 400, 'Invalid Paytm configuration');
    }

    // Update order with payment info
    await OrderRepository.updateById(orderId, {
      payment_provider: 'paytm_upi',
      payment_order_id: orderId
    });

    // Create UPI payment data using admin's Paytm MID
    const merchantUpiId = `${paytmConfig.key_id}@paytm`;
    const upiString = `upi://pay?pa=${merchantUpiId}&pn=${encodeURIComponent(tenant.name)}&am=${amount}&cu=INR&tn=Order%20${orderId}&tr=${orderId}`;
    
    const upiPaymentData = {
      orderId: orderId,
      amount: parseFloat(amount),
      currency: 'INR',
      merchantId: paytmConfig.key_id,
      merchantUpiId: merchantUpiId,
      restaurantName: tenant.name,
      
      // UPI payment data
      upiString: upiString,
      qrCodeUrl: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiString)}`,
      
      // Payment instructions
      instructions: 'Scan QR code or click Pay Now to open your UPI app',
      paymentMethod: 'paytm_upi'
    };

    console.log('UPI payment created successfully:', {
      orderId,
      merchantId: paytmConfig.key_id,
      merchantUpiId
    });

    successResponse(res, 201, upiPaymentData, 'UPI payment created successfully');

  } catch (error) {
    console.error('Create UPI payment error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Paytm payment callback
 * POST /api/paytm-fixed/callback
 */
router.post('/callback', async (req, res) => {
  try {
    const response = req.body;
    console.log('Paytm callback received:', response);

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

    // Verify checksum using correct method
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
      try {
        const io = req.app?.get('io');
        if (io) {
          const orderItems = await OrderItemRepository.findByOrder(ORDERID);
          const table = await RestaurantTableRepository.findById(order.table_id);
          
          const kitchenNotification = {
            orderId: ORDERID,
            tableId: order.table_id,
            tableName: table?.name || 'Table',
            status: orderStatus,
            paymentMethod: 'paytm',
            paymentStatus: paymentStatus,
            totalAmount: order.total_amount,
            items: orderItems.map(item => ({
              name: item.name_snapshot,
              quantity: item.quantity,
              price: item.price_snapshot,
              notes: item.notes
            })),
            createdAt: order.created_at,
            confirmedAt: new Date().toISOString(),
            message: '🔥 NEW PAYTM ORDER - PAYMENT CONFIRMED!'
          };
          
          io.to(`tenant-${tenant.id}`).emit('new-order', kitchenNotification);
          io.to(`kitchen-${tenant.id}`).emit('kitchen-order', kitchenNotification);
          
          console.log('Kitchen notification sent for successful payment:', ORDERID);
        }
      } catch (notificationError) {
        console.error('Kitchen notification error:', notificationError);
      }
    }

    // Return success response
    successResponse(res, 200, {
      orderId: ORDERID,
      transactionId: verificationResult.transactionId,
      status: verificationResult.status,
      paymentStatus,
      message: verificationResult.responseMessage || 'Payment processed'
    });

  } catch (error) {
    console.error('Paytm callback error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Confirm payment manually (for UPI payments)
 * POST /api/paytm-fixed/confirm-payment
 */
router.post('/confirm-payment', async (req, res) => {
  try {
    const { orderId, transactionId, status = 'SUCCESS' } = req.body;

    console.log('Manual payment confirmation:', { orderId, transactionId, status });

    if (!orderId) {
      return errorResponse(res, 400, 'Order ID is required');
    }

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

    // Update order status
    const paymentId = transactionId || `PAYTM_MANUAL_${Date.now()}`;
    
    await OrderRepository.updateById(orderId, {
      status: 'confirmed',
      payment_status: 'completed',
      payment_id: paymentId
    });

    // Send kitchen notification
    try {
      const io = req.app?.get('io');
      if (io) {
        const orderItems = await OrderItemRepository.findByOrder(orderId);
        const table = await RestaurantTableRepository.findById(order.table_id);
        
        const kitchenNotification = {
          orderId: orderId,
          tableId: order.table_id,
          tableName: table?.name || 'Table',
          status: 'confirmed',
          paymentMethod: 'paytm',
          paymentStatus: 'completed',
          totalAmount: order.total_amount,
          items: orderItems.map(item => ({
            name: item.name_snapshot,
            quantity: item.quantity,
            price: item.price_snapshot,
            notes: item.notes
          })),
          createdAt: order.created_at,
          confirmedAt: new Date().toISOString(),
          message: '🔥 NEW PAYTM ORDER - PAYMENT CONFIRMED!'
        };
        
        io.to(`tenant-${tenant.id}`).emit('new-order', kitchenNotification);
        io.to(`kitchen-${tenant.id}`).emit('kitchen-order', kitchenNotification);
        
        console.log('Kitchen notification sent for manual confirmation:', orderId);
      }
    } catch (notificationError) {
      console.error('Kitchen notification error:', notificationError);
    }

    successResponse(res, 200, {
      orderId,
      status: 'confirmed',
      paymentStatus: 'completed',
      paymentMethod: 'paytm',
      transactionId: paymentId,
      message: 'Payment confirmed! Order sent to kitchen.'
    });

  } catch (error) {
    console.error('Confirm payment error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

/**
 * Check payment status
 * GET /api/paytm-fixed/status/:orderId
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

    // Check transaction status with Paytm using correct API
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

module.exports = router;