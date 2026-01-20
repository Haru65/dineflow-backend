const express = require('express');
const router = express.Router();
const { generateId, errorResponse, successResponse, formatTimestamp } = require('../utils/helpers');
const TenantRepository = require('../repositories/TenantRepository');
const RestaurantTableRepository = require('../repositories/RestaurantTableRepository');
const MenuCategoryRepository = require('../repositories/MenuCategoryRepository');
const MenuItemRepository = require('../repositories/MenuItemRepository');
const OrderRepository = require('../repositories/OrderRepository');
const OrderItemRepository = require('../repositories/OrderItemRepository');
const PaymentProviderRepository = require('../repositories/PaymentProviderRepository');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const EmailService = require('../utils/emailService');

// Health check endpoint - returns server time for clock sync
router.get('/health', (req, res) => {
  successResponse(res, 200, {
    status: 'ok',
    serverTime: new Date().toISOString(),
    timestamp: Date.now()
  });
});

// Get public menu for a table
router.get('/menu/:restaurantSlug/:tableIdentifier', async (req, res) => {
  try {
    const { restaurantSlug, tableIdentifier } = req.params;

    // Find restaurant by slug
    const tenant = await TenantRepository.findBySlug(restaurantSlug);
    if (!tenant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Find table
    const table = await RestaurantTableRepository.findByIdentifier(tenant.id, tableIdentifier);
    if (!table) {
      return errorResponse(res, 404, 'Table not found');
    }

    // Get categories with items
    const categories = await MenuCategoryRepository.findByTenant(tenant.id);
    const categoriesWithItems = await Promise.all(
      categories.map(async (cat) => ({
        ...cat,
        items: await MenuItemRepository.findByCategoryAndTenant(tenant.id, cat.id)
      }))
    );

    successResponse(res, 200, {
      restaurant: {
        id: tenant.id,
        name: tenant.name,
        address: tenant.address,
        contact_phone: tenant.contact_phone
      },
      table: {
        id: table.id,
        name: table.name,
        identifier: table.identifier
      },
      categories: categoriesWithItems
    });
  } catch (error) {
    console.error('Get menu error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create order from QR
router.post('/order/:restaurantSlug/:tableIdentifier', async (req, res) => {
  try {
    const { restaurantSlug, tableIdentifier } = req.params;
    const { items, paymentMethod, notes } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 400, 'Order items are required');
    }

    // Find restaurant
    const tenant = await TenantRepository.findBySlug(restaurantSlug);
    if (!tenant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Find table
    const table = await RestaurantTableRepository.findByIdentifier(tenant.id, tableIdentifier);
    if (!table) {
      return errorResponse(res, 404, 'Table not found');
    }

    // Validate and calculate order total
    let totalAmount = 0;
    const validatedItems = [];

    for (const item of items) {
      const menuItem = await MenuItemRepository.findById(item.menu_item_id);
      if (!menuItem || menuItem.tenant_id !== tenant.id || !menuItem.is_available) {
        return errorResponse(res, 400, `Menu item ${item.menu_item_id} is not available`);
      }

      const quantity = parseInt(item.quantity) || 1;
      validatedItems.push({
        ...item,
        quantity,
        price_snapshot: parseFloat(menuItem.price)
      });

      totalAmount += parseFloat(menuItem.price) * quantity;
    }

    // Create order
    const paymentStatus = paymentMethod === 'online' ? 'pending' : 'pending';
    const paymentProvider = paymentMethod === 'online' ? 'razorpay' : 'cash';

    const orderId = await OrderRepository.create({
      tenant_id: tenant.id,
      table_id: table.id,
      source_type: 'table',
      source_reference: tableIdentifier,
      status: 'pending',
      payment_status: paymentStatus,
      payment_provider: paymentProvider,
      total_amount: totalAmount,
      notes
    });

    // Create order items
    for (const item of validatedItems) {
      const menuItem = await MenuItemRepository.findById(item.menu_item_id);
      await OrderItemRepository.create({
        order_id: orderId,
        menu_item_id: item.menu_item_id,
        name_snapshot: menuItem.name,
        price_snapshot: item.price_snapshot,
        quantity: item.quantity
      });
    }

    // Get the created order with items
    const createdOrder = await OrderRepository.findById(orderId);
    const orderItems = await OrderItemRepository.findByOrder(orderId);
    
    // Send order confirmation email
    EmailService.sendOrderConfirmation(
      tenant.id,
      createdOrder,
      orderItems,
      tenant.name,
      null // Customer email if available
    ).catch(err => console.error('Email send failed:', err));

    // Return full order object with items
    successResponse(res, 201, {
      id: createdOrder.id,
      orderId: createdOrder.id,
      orderNumber: createdOrder.order_number || `ORD-${createdOrder.id}`,
      status: createdOrder.status,
      total: parseFloat(createdOrder.total_amount),
      totalAmount: createdOrder.total_amount,
      paymentMethod,
      paymentStatus: createdOrder.payment_status,
      created_at: formatTimestamp(createdOrder.created_at),
      table: {
        id: table.id,
        name: table.name
      },
      items: orderItems.map(item => ({
        id: item.id,
        quantity: item.quantity,
        status: 'pending',
        menuItem: {
          name: item.name_snapshot,
          price: item.price_snapshot,
          isVeg: item.isVeg
        }
      }))
    }, 'Order created successfully');
  } catch (error) {
    console.error('Create order error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create Razorpay order
router.post('/payment/create-order', async (req, res) => {
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

    // Get payment config
    const paymentConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'razorpay');
    if (!paymentConfig) {
      return errorResponse(res, 400, 'Payment not configured for this restaurant');
    }

    // Create Razorpay instance
    const razorpay = new Razorpay({
      key_id: paymentConfig.key_id,
      key_secret: paymentConfig.key_secret
    });

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(order.total_amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `order_${orderId}`,
      notes: {
        orderId,
        restaurantId: tenant.id
      }
    });

    // Update order with Razorpay order ID
    await OrderRepository.updateById(orderId, {
      payment_order_id: razorpayOrder.id
    });

    successResponse(res, 201, {
      razorpayOrderId: razorpayOrder.id,
      amount: order.total_amount,
      currency: 'INR',
      keyId: paymentConfig.key_id
    });
  } catch (error) {
    console.error('Create Razorpay order error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Verify payment
router.post('/payment/verify', async (req, res) => {
  try {
    const { orderId, razorpayPaymentId, razorpayOrderId, razorpaySignature, restaurantSlug } = req.body;

    if (!orderId || !razorpayPaymentId || !razorpayOrderId || !razorpaySignature) {
      return errorResponse(res, 400, 'Missing payment verification details');
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

    // Get payment config
    const paymentConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'razorpay');
    if (!paymentConfig) {
      return errorResponse(res, 400, 'Payment not configured for this restaurant');
    }

    // Verify signature
    const shasum = crypto.createHmac('sha256', paymentConfig.key_secret);
    shasum.update(`${razorpayOrderId}|${razorpayPaymentId}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpaySignature) {
      return errorResponse(res, 400, 'Invalid payment signature');
    }

    // Update order payment status
    await OrderRepository.updatePaymentStatus(
      orderId,
      'paid',
      razorpayPaymentId,
      razorpayOrderId
    );

    successResponse(res, 200, {
      success: true,
      orderId,
      paymentId: razorpayPaymentId
    }, 'Payment verified successfully');
  } catch (error) {
    console.error('Verify payment error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get order status (for public access)
router.get('/order/:restaurantSlug/:orderId', async (req, res) => {
  try {
    const { restaurantSlug, orderId } = req.params;

    const order = await OrderRepository.findById(orderId);
    if (!order) {
      return errorResponse(res, 404, 'Order not found');
    }

    const tenant = await TenantRepository.findBySlug(restaurantSlug);
    if (!tenant || tenant.id !== order.tenant_id) {
      return errorResponse(res, 404, 'Restaurant not found or order mismatch');
    }

    const items = await OrderItemRepository.findByOrder(orderId);

    successResponse(res, 200, {
      ...order,
      created_at: formatTimestamp(order.created_at),
      updated_at: formatTimestamp(order.updated_at),
      items
    });
  } catch (error) {
    console.error('Get order status error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Razorpay webhook endpoint
router.post('/payment/webhook', async (req, res) => {
  try {
    const { event, payload } = req.body;

    if (!event) {
      return errorResponse(res, 400, 'Event type missing');
    }

    // Handle different payment events
    if (event === 'payment.authorized' || event === 'payment.captured') {
      const { razorpay_payment_id, razorpay_order_id } = payload.payment.entity;

      // Find order by Razorpay order ID
      const order = await OrderRepository.findByPaymentOrderId(razorpay_order_id);
      if (!order) {
        console.log(`Order not found for Razorpay order ID: ${razorpay_order_id}`);
        return successResponse(res, 200, { status: 'acknowledged' });
      }

      // Get payment config to verify webhook signature if provided
      const paymentConfig = await PaymentProviderRepository.findByTenant(order.tenant_id, 'razorpay');
      
      // Update order payment status
      await OrderRepository.updatePaymentStatus(
        order.id,
        'completed',
        razorpay_payment_id,
        razorpay_order_id
      );

      // Send email notification
      const tenant = await TenantRepository.findById(order.tenant_id);
      const items = await OrderItemRepository.findByOrder(order.id);
      
      if (tenant && items.length > 0) {
        // Send confirmation email
        EmailService.sendPaymentConfirmation(
          order.tenant_id,
          order,
          tenant.name,
          null // Customer email if available
        ).catch(err => console.error('Email send failed:', err));
      }

      successResponse(res, 200, { status: 'acknowledged' });
    } 
    else if (event === 'payment.failed') {
      const { razorpay_payment_id, razorpay_order_id } = payload.payment.entity;

      // Find order by Razorpay order ID
      const order = await OrderRepository.findByPaymentOrderId(razorpay_order_id);
      if (!order) {
        return successResponse(res, 200, { status: 'acknowledged' });
      }

      // Update order payment status to failed
      await OrderRepository.updatePaymentStatus(
        order.id,
        'failed',
        razorpay_payment_id,
        razorpay_order_id
      );

      successResponse(res, 200, { status: 'acknowledged' });
    }
    else if (event === 'payment.refunded') {
      const { razorpay_payment_id, razorpay_order_id } = payload.payment.entity;

      // Find order by Razorpay order ID
      const order = await OrderRepository.findByPaymentOrderId(razorpay_order_id);
      if (!order) {
        return successResponse(res, 200, { status: 'acknowledged' });
      }

      // Update order payment status to refunded
      await OrderRepository.updatePaymentStatus(
        order.id,
        'refunded',
        razorpay_payment_id,
        razorpay_order_id
      );

      successResponse(res, 200, { status: 'acknowledged' });
    }
    else {
      // Acknowledge other events
      successResponse(res, 200, { status: 'acknowledged' });
    }
  } catch (error) {
    console.error('Webhook error:', error);
    // Always return 200 to acknowledge receipt, even if there's an error
    res.status(200).json({ status: 'acknowledged', error: error.message });
  }
});

module.exports = router;
