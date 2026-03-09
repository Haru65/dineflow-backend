/**
 * Webhook Handlers for Payment Gateways and Third-Party Integrations
 * Handles: Razorpay, Zomato, Swiggy
 */

const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const { errorResponse, successResponse } = require('../utils/helpers');
const { asyncHandler, ValidationError } = require('../utils/errorHandler');
const OrderRepository = require('../repositories/OrderRepository');
const PaymentProviderRepository = require('../repositories/PaymentProviderRepository');
const TenantRepository = require('../repositories/TenantRepository');
const IntegrationRepository = require('../repositories/IntegrationRepository');
const EmailService = require('../utils/emailService');

/**
 * Razorpay Webhook Handler
 * Handles payment.authorized, payment.failed, payment.captured events
 */
router.post('/razorpay', asyncHandler(async (req, res) => {
  const { event, payload } = req.body;
  const signature = req.headers['x-razorpay-signature'];

  if (!event || !payload) {
    return errorResponse(res, 400, 'Invalid webhook payload');
  }

  // Verify webhook signature
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.warn('RAZORPAY_WEBHOOK_SECRET not configured');
    return successResponse(res, 200, { status: 'ok' });
  }

  const hmac = crypto
    .createHmac('sha256', webhookSecret)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hmac !== signature) {
    console.error('Invalid Razorpay webhook signature');
    return errorResponse(res, 401, 'Invalid signature');
  }

  try {
    const { payment, order } = payload;

    if (!payment || !order) {
      return errorResponse(res, 400, 'Missing payment or order data');
    }

    // Extract order ID from notes
    const orderId = order.notes?.orderId;
    const tenantId = order.notes?.restaurantId;

    if (!orderId || !tenantId) {
      console.error('Missing orderId or tenantId in webhook payload');
      return errorResponse(res, 400, 'Missing order or tenant information');
    }

    // Get order
    const dbOrder = await OrderRepository.findById(orderId);
    if (!dbOrder || dbOrder.tenant_id !== tenantId) {
      console.error(`Order not found or tenant mismatch: ${orderId}`);
      return errorResponse(res, 404, 'Order not found');
    }

    // Handle different payment events
    switch (event) {
      case 'payment.authorized':
      case 'payment.captured':
        // Payment successful
        await OrderRepository.updatePaymentStatus(
          orderId,
          'paid',
          payment.id,
          order.id
        );

        // Send confirmation email
        EmailService.sendPaymentConfirmation(tenantId, dbOrder, payment.id)
          .catch(err => console.error('Email send failed:', err));

        console.log(`Payment captured for order ${orderId}: ${payment.id}`);
        break;

      case 'payment.failed':
        // Payment failed
        await OrderRepository.updatePaymentStatus(
          orderId,
          'failed',
          payment.id,
          order.id
        );

        // Send failure notification
        EmailService.sendPaymentFailureNotification(tenantId, dbOrder, payment.error_description)
          .catch(err => console.error('Email send failed:', err));

        console.log(`Payment failed for order ${orderId}: ${payment.error_description}`);
        break;

      default:
        console.log(`Unhandled Razorpay event: ${event}`);
    }

    // Acknowledge webhook
    successResponse(res, 200, { status: 'ok' });
  } catch (error) {
    console.error('Razorpay webhook error:', error);
    // Still return 200 to prevent Razorpay from retrying
    successResponse(res, 200, { status: 'ok', error: error.message });
  }
}));

/**
 * Zomato Webhook Handler
 * Handles order creation, status updates, cancellations
 */
router.post('/zomato', asyncHandler(async (req, res) => {
  const { event_type, order_id, order_status, items, total_amount, customer_phone } = req.body;

  if (!event_type || !order_id) {
    return errorResponse(res, 400, 'Missing event_type or order_id');
  }

  try {
    // Verify webhook signature (if Zomato provides one)
    const signature = req.headers['x-zomato-signature'];
    if (signature) {
      const secret = process.env.ZOMATO_WEBHOOK_SECRET;
      if (secret) {
        const hmac = crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (hmac !== signature) {
          return errorResponse(res, 401, 'Invalid signature');
        }
      }
    }

    // Get tenant with Zomato integration
    const integration = await IntegrationRepository.findByExternalId('zomato', order_id);
    if (!integration) {
      console.warn(`Zomato order not found in system: ${order_id}`);
      return successResponse(res, 200, { status: 'ok' });
    }

    const tenant = await TenantRepository.findById(integration.tenant_id);
    if (!tenant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Handle different event types
    switch (event_type) {
      case 'order.created':
        // Create order in DineFlow
        const newOrder = await OrderRepository.create({
          tenant_id: tenant.id,
          source_type: 'zomato',
          source_reference: order_id,
          status: 'pending',
          payment_status: 'pending',
          payment_provider: 'zomato',
          total_amount: parseFloat(total_amount),
          notes: `Zomato Order: ${order_id}`
        });

        // Store mapping
        await IntegrationRepository.updateOrderMapping(
          integration.id,
          newOrder,
          order_id
        );

        // Send order confirmation
        EmailService.sendOrderConfirmation(tenant.id, newOrder, items, tenant.name, customer_phone)
          .catch(err => console.error('Email send failed:', err));

        console.log(`Zomato order created: ${order_id} -> ${newOrder}`);
        break;

      case 'order.status_update':
        // Update order status
        const statusMapping = {
          'confirmed': 'accepted',
          'preparing': 'preparing',
          'ready': 'ready',
          'delivered': 'completed',
          'cancelled': 'cancelled'
        };

        const newStatus = statusMapping[order_status] || order_status;
        const dineflowOrder = await OrderRepository.findByExternalId('zomato', order_id);

        if (dineflowOrder) {
          await OrderRepository.updateById(dineflowOrder.id, {
            status: newStatus,
            updated_at: new Date().toISOString()
          });

          console.log(`Zomato order status updated: ${order_id} -> ${newStatus}`);
        }
        break;

      case 'order.cancelled':
        // Cancel order
        const cancelledOrder = await OrderRepository.findByExternalId('zomato', order_id);
        if (cancelledOrder) {
          await OrderRepository.updateById(cancelledOrder.id, {
            status: 'cancelled',
            updated_at: new Date().toISOString()
          });

          console.log(`Zomato order cancelled: ${order_id}`);
        }
        break;

      default:
        console.log(`Unhandled Zomato event: ${event_type}`);
    }

    successResponse(res, 200, { status: 'ok' });
  } catch (error) {
    console.error('Zomato webhook error:', error);
    successResponse(res, 200, { status: 'ok', error: error.message });
  }
}));

/**
 * Swiggy Webhook Handler
 * Handles order creation, status updates, cancellations
 */
router.post('/swiggy', asyncHandler(async (req, res) => {
  const { event, data } = req.body;

  if (!event || !data) {
    return errorResponse(res, 400, 'Missing event or data');
  }

  try {
    // Verify webhook signature (if Swiggy provides one)
    const signature = req.headers['x-swiggy-signature'];
    if (signature) {
      const secret = process.env.SWIGGY_WEBHOOK_SECRET;
      if (secret) {
        const hmac = crypto
          .createHmac('sha256', secret)
          .update(JSON.stringify(req.body))
          .digest('hex');

        if (hmac !== signature) {
          return errorResponse(res, 401, 'Invalid signature');
        }
      }
    }

    const { order_id, status, items, total, customer_phone } = data;

    if (!order_id) {
      return errorResponse(res, 400, 'Missing order_id');
    }

    // Get tenant with Swiggy integration
    const integration = await IntegrationRepository.findByExternalId('swiggy', order_id);
    if (!integration) {
      console.warn(`Swiggy order not found in system: ${order_id}`);
      return successResponse(res, 200, { status: 'ok' });
    }

    const tenant = await TenantRepository.findById(integration.tenant_id);
    if (!tenant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Handle different event types
    switch (event) {
      case 'order_placed':
        // Create order in DineFlow
        const newOrder = await OrderRepository.create({
          tenant_id: tenant.id,
          source_type: 'swiggy',
          source_reference: order_id,
          status: 'pending',
          payment_status: 'pending',
          payment_provider: 'swiggy',
          total_amount: parseFloat(total),
          notes: `Swiggy Order: ${order_id}`
        });

        // Store mapping
        await IntegrationRepository.updateOrderMapping(
          integration.id,
          newOrder,
          order_id
        );

        // Send order confirmation
        EmailService.sendOrderConfirmation(tenant.id, newOrder, items, tenant.name, customer_phone)
          .catch(err => console.error('Email send failed:', err));

        console.log(`Swiggy order created: ${order_id} -> ${newOrder}`);
        break;

      case 'order_status_changed':
        // Update order status
        const statusMapping = {
          'confirmed': 'accepted',
          'preparing': 'preparing',
          'ready_for_pickup': 'ready',
          'completed': 'completed',
          'cancelled': 'cancelled'
        };

        const newStatus = statusMapping[status] || status;
        const dineflowOrder = await OrderRepository.findByExternalId('swiggy', order_id);

        if (dineflowOrder) {
          await OrderRepository.updateById(dineflowOrder.id, {
            status: newStatus,
            updated_at: new Date().toISOString()
          });

          console.log(`Swiggy order status updated: ${order_id} -> ${newStatus}`);
        }
        break;

      case 'order_cancelled':
        // Cancel order
        const cancelledOrder = await OrderRepository.findByExternalId('swiggy', order_id);
        if (cancelledOrder) {
          await OrderRepository.updateById(cancelledOrder.id, {
            status: 'cancelled',
            updated_at: new Date().toISOString()
          });

          console.log(`Swiggy order cancelled: ${order_id}`);
        }
        break;

      default:
        console.log(`Unhandled Swiggy event: ${event}`);
    }

    successResponse(res, 200, { status: 'ok' });
  } catch (error) {
    console.error('Swiggy webhook error:', error);
    successResponse(res, 200, { status: 'ok', error: error.message });
  }
}));

/**
 * Health check for webhooks
 */
router.get('/health', (req, res) => {
  successResponse(res, 200, {
    status: 'ok',
    webhooks: ['razorpay', 'zomato', 'swiggy'],
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
