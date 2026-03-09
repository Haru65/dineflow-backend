const express = require('express');
const router = express.Router();
const { generateId, errorResponse, successResponse } = require('../utils/helpers');
const PaytmService = require('../utils/paytmService');
const OrderRepository = require('../repositories/OrderRepository');
const TenantRepository = require('../repositories/TenantRepository');
const PaymentProviderRepository = require('../repositories/PaymentProviderRepository');
const EmailService = require('../utils/emailService');

/**
 * Create Paytm payment order
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

    // Create payment request
    const paymentParams = PaytmService.createPaymentRequest(
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

    // Return payment form data
    successResponse(res, 201, {
      paytmOrderId: orderId,
      amount: order.total_amount,
      currency: 'INR',
      paymentParams,
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
    const { ORDER_ID, CHECKSUMHASH } = response;

    if (!ORDER_ID || !CHECKSUMHASH) {
      return errorResponse(res, 400, 'Invalid callback data');
    }

    // Get order
    const order = await OrderRepository.findById(ORDER_ID);
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

    // Verify checksum
    const verificationResult = PaytmService.verifyPaymentResponse(response, paymentConfig.key_secret);

    if (!verificationResult.isValid) {
      console.error('Invalid checksum for order:', ORDER_ID);
      return errorResponse(res, 400, 'Invalid payment signature');
    }

    // Update order based on payment status
    const paymentStatus = verificationResult.status === 'TXN_SUCCESS' ? 'completed' : 'failed';
    const orderStatus = verificationResult.status === 'TXN_SUCCESS' ? 'confirmed' : 'pending';

    await OrderRepository.updateById(ORDER_ID, {
      payment_status: paymentStatus,
      status: orderStatus,
      payment_id: verificationResult.transactionId,
      payment_order_id: verificationResult.orderId
    });

    // Send confirmation email if payment successful
    if (paymentStatus === 'completed') {
      EmailService.sendPaymentConfirmation(
        tenant.id,
        order,
        verificationResult.transactionId,
        tenant.name
      ).catch(err => console.error('Email send failed:', err));
    }

    // Return success response
    successResponse(res, 200, {
      orderId: ORDER_ID,
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
        status: statusResponse.STATUS,
        transactionId: statusResponse.TXNID,
        amount: statusResponse.TXNAMOUNT,
        responseCode: statusResponse.RESPCODE,
        responseMessage: statusResponse.RESPMSG
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
