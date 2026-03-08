/**
 * Paytm Payment Routes
 * Handles payment creation, callback verification, and transaction confirmation
 */

const express = require('express');
const router = express.Router();
const paytmService = require('../services/paytmService');
const OrderRepository = require('../repositories/OrderRepository');
const PaymentProviderRepository = require('../repositories/PaymentProviderRepository');

/**
 * POST /api/payment/paytm/create-order
 * Create a Paytm payment order and return payment payload
 * 
 * Request Body:
 * {
 *   "orderId": "order-123",
 *   "amount": 500.00,
 *   "customerId": "customer-123",
 *   "customerEmail": "customer@example.com",
 *   "customerPhoneNumber": "+919999999999"
 * }
 */
router.post('/create-order', async (req, res) => {
  try {
    const {
      orderId,
      amount,
      customerId,
      customerEmail,
      customerPhoneNumber,
      tenantId
    } = req.body;

    // Validate required fields
    if (!orderId || !amount || !customerId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['orderId', 'amount', 'customerId']
      });
    }

    // Validate amount
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({
        error: 'Invalid amount. Must be a positive number.'
      });
    }

    // Check if order exists and belongs to this tenant
    if (tenantId) {
      const order = await OrderRepository.findById(orderId);
      if (!order || order.tenant_id !== tenantId) {
        return res.status(404).json({
          error: 'Order not found or unauthorized'
        });
      }
    }

    console.log(`\n💳 Creating Paytm payment for order: ${orderId}`);
    console.log(`   Amount: ₹${amount}`);

    // Create Paytm payment order
    const result = await paytmService.createPaymentOrder({
      orderId,
      amount,
      customerId,
      customerEmail,
      customerPhoneNumber,
      restaurantId: tenantId,
      orderDescription: `DineFlow Order #${orderId}`
    });

    if (!result.success) {
      console.error('❌ Failed to create Paytm order:', result.error);
      return res.status(500).json({
        error: 'Failed to create payment order',
        details: result.error
      });
    }

    // Extract only the necessary data for frontend
    const paymentPayload = {
      orderId: result.data.orderId,
      amount: result.data.amount,
      checksum: result.data.checksum,
      mid: result.data.mid,
      website: result.data.website,
      channelId: 'WEB',
      industryTypeId: 'etail',
      paytmUrl: result.data.initiateTransactionUrl
    };

    console.log(`✅ Payment order created successfully`);

    res.json({
      success: true,
      data: paymentPayload,
      message: 'Payment order created. Proceed to Paytm.'
    });

  } catch (error) {
    console.error('❌ Error in /create-order:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/payment/paytm/callback
 * Receive and verify Paytm payment callback
 * 
 * Callback parameters from Paytm:
 * - ORDERID
 * - TXNID
 * - TXNAMOUNT
 * - STATUS (TXN_SUCCESS, TXN_FAILURE, PENDING, CANCELLED)
 * - CHECKSUMHASH
 * - RESPCODE
 * - RESPMSG
 * - BANKNAME
 * - PAYMENTMODE
 * - etc.
 */
router.post('/callback', async (req, res) => {
  try {
    const callbackData = req.body;

    console.log(`\n📨 Paytm callback received`);
    console.log(`   Order ID: ${callbackData.ORDERID}`);
    console.log(`   Status: ${callbackData.STATUS}`);

    // Verify checksum
    const isValidChecksum = await paytmService.verifyChecksum(callbackData);

    if (!isValidChecksum) {
      console.error('❌ Checksum verification failed for order:', callbackData.ORDERID);
      
      // Still update database to mark as suspicious
      const orderId = callbackData.ORDERID;
      if (orderId) {
        try {
          await OrderRepository.updateById(orderId, {
            payment_status: 'failed',
            notes: 'Payment callback failed checksum verification - SUSPICIOUS'
          });
        } catch (e) {
          console.error('Error updating order:', e);
        }
      }

      return res.status(400).json({
        error: 'Checksum verification failed',
        orderId: callbackData.ORDERID
      });
    }

    // Parse the callback response
    const parsedResponse = paytmService.parseCallbackResponse(callbackData);

    console.log(`✅ Checksum verified`);
    console.log(`   Transaction ID: ${parsedResponse.txnId}`);
    console.log(`   Amount: ₹${parsedResponse.amount}`);

    const orderId = parsedResponse.orderId;

    // Update order with payment information
    const updateData = {
      payment_status: parsedResponse.isSuccess ? 'paid' : 'failed',
      razorpay_payment_id: parsedResponse.txnId, // Reusing field for Paytm txn ID
      order_status: parsedResponse.isSuccess ? 'confirmed' : 'pending'
    };

    // Add notes about payment
    updateData.notes = 
      `Paytm Payment - ${parsedResponse.isSuccess ? 'SUCCESS' : 'FAILED'}\n` +
      `Transaction ID: ${parsedResponse.txnId}\n` +
      `Response Code: ${parsedResponse.responseCode}\n` +
      `Response Message: ${parsedResponse.responseMessage}\n` +
      `Payment Mode: ${parsedResponse.paymentMode || 'N/A'}\n` +
      `Bank: ${parsedResponse.bankName || 'N/A'}`;

    await OrderRepository.updateById(orderId, updateData);

    if (parsedResponse.isSuccess) {
      console.log(`🎉 Order ${orderId} marked as PAID`);
    } else {
      console.log(`⚠️  Order ${orderId} payment FAILED`);
    }

    // Return success response to Paytm
    res.json({
      success: true,
      orderId: orderId,
      transactionId: parsedResponse.txnId,
      status: parsedResponse.status,
      message: parsedResponse.isSuccess ? 'Payment successful' : 'Payment failed'
    });

  } catch (error) {
    console.error('❌ Error in /callback:', error.message);
    res.status(500).json({
      error: 'Internal server error',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/payment/paytm/verify/:orderId
 * Verify payment status for a specific order
 * Can be called to get the latest transaction status from Paytm
 */
router.get('/verify/:orderId', async (req, res) => {
  try {
    const { orderId } = req.params;

    console.log(`\n🔍 Verifying Paytm transaction for order: ${orderId}`);

    // Verify transaction status from Paytm
    const verificationResult = await paytmService.verifyTransaction(orderId);

    if (!verificationResult.success) {
      console.warn(`⚠️  Transaction verification returned non-success code:`, verificationResult.resultCode);
      return res.json({
        success: false,
        error: verificationResult.error,
        orderId: orderId
      });
    }

    // Update order based on verification result
    const isSuccess = verificationResult.status === 'TXN_SUCCESS';
    
    await OrderRepository.updateById(orderId, {
      payment_status: isSuccess ? 'paid' : 'failed',
      razorpay_payment_id: verificationResult.txnId,
      order_status: isSuccess ? 'confirmed' : 'pending'
    });

    console.log(`✅ Order ${orderId} payment status updated`);

    res.json({
      success: true,
      data: {
        orderId: verificationResult.orderId,
        transactionId: verificationResult.txnId,
        status: verificationResult.status,
        statusLabel: paytmService.getStatusLabel(verificationResult.status),
        amount: verificationResult.txnAmount,
        paymentMode: verificationResult.paymentMode,
        bankName: verificationResult.bankName,
        txnDate: verificationResult.txnDate
      },
      message: isSuccess ? 'Payment verified successfully' : 'Payment verification failed'
    });

  } catch (error) {
    console.error('❌ Error in /verify:', error.message);
    res.status(500).json({
      error: 'Failed to verify payment',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * GET /api/payment/paytm/config
 * Get Paytm configuration (without sensitive keys)
 * Used by frontend to display payment method availability
 */
router.get('/config', (req, res) => {
  try {
    const configAvailable = !!(
      process.env.PAYTM_MID &&
      process.env.PAYTM_MERCHANT_KEY &&
      process.env.PAYTM_WEBSITE
    );

    res.json({
      success: true,
      data: {
        isConfigured: configAvailable,
        environment: process.env.PAYTM_ENVIRONMENT || 'staging',
        mid: process.env.PAYTM_MID ? process.env.PAYTM_MID.substring(0, 5) + '***' : null,
        website: process.env.PAYTM_WEBSITE || null,
        callbackUrl: process.env.PAYTM_CALLBACK_URL || null
      }
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get Paytm configuration',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * POST /api/payment/paytm/test
 * Test Paytm integration (development only)
 */
router.post('/test', (req, res) => {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return res.status(403).json({
      error: 'Test endpoint only available in development'
    });
  }

  try {
    console.log('\n🧪 Paytm Integration Test');
    console.log('==========================');
    console.log(`Environment: ${process.env.PAYTM_ENVIRONMENT || 'staging'}`);
    console.log(`MID Configured: ${!!process.env.PAYTM_MID}`);
    console.log(`Merchant Key Configured: ${!!process.env.PAYTM_MERCHANT_KEY}`);
    console.log(`Website: ${process.env.PAYTM_WEBSITE || 'NOT SET'}`);
    console.log(`Callback URL: ${process.env.PAYTM_CALLBACK_URL || 'NOT SET'}`);

    // Test Order ID generation
    const testOrderId = paytmService.generateOrderId();
    console.log(`\nGenerated Test Order ID: ${testOrderId}`);

    res.json({
      success: true,
      data: {
        environment: process.env.PAYTM_ENVIRONMENT || 'staging',
        midConfigured: !!process.env.PAYTM_MID,
        merchantKeyConfigured: !!process.env.PAYTM_MERCHANT_KEY,
        website: process.env.PAYTM_WEBSITE,
        callbackUrl: process.env.PAYTM_CALLBACK_URL,
        testOrderId: testOrderId,
        message: 'Paytm integration is properly configured'
      }
    });

  } catch (error) {
    res.status(500).json({
      error: 'Test failed',
      details: error.message
    });
  }
});

module.exports = router;
