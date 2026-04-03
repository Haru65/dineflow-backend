const express = require('express');
const router = express.Router();
const {
  authenticateToken,
  authorizeRestaurantAdmin
} = require('../utils/auth');
const {
  generateId,
  generateQRUrl,
  sanitizeTableIdentifier,
  formatTimestamp,
  errorResponse,
  successResponse
} = require('../utils/helpers');
const TenantRepository = require('../repositories/TenantRepository');
const RestaurantTableRepository = require('../repositories/RestaurantTableRepository');
const MenuCategoryRepository = require('../repositories/MenuCategoryRepository');
const MenuItemRepository = require('../repositories/MenuItemRepository');
const OrderRepository = require('../repositories/OrderRepository');
const OrderItemRepository = require('../repositories/OrderItemRepository');
const IntegrationRepository = require('../repositories/IntegrationRepository');
const EmailConfigRepository = require('../repositories/EmailConfigRepository');
const ReportsRepository = require('../repositories/ReportsRepository');
const EmailService = require('../utils/emailService');

// Middleware to verify tenant access
const verifyTenantAccess = async (req, res, next) => {
  const tenantId = req.params.tenantId;
  
  if (req.user.role === 'superadmin') {
    next();
  } else if (req.user.role === 'restaurant_admin' && req.user.tenantId === tenantId) {
    next();
  } else {
    errorResponse(res, 403, 'Access denied');
  }
};

// ===================== TABLES =====================

// Get all tables for restaurant
router.get('/:tenantId/tables', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const tables = await RestaurantTableRepository.findByTenant(req.params.tenantId);
    successResponse(res, 200, tables);
  } catch (error) {
    console.error('Get tables error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create table
router.post('/:tenantId/tables', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { name, identifier } = req.body;

    if (!name || !identifier) {
      return errorResponse(res, 400, 'Name and identifier are required');
    }

    // Sanitize identifier to ensure valid format (lowercase, hyphens, no spaces)
    const sanitizedIdentifier = sanitizeTableIdentifier(identifier);
    
    if (!sanitizedIdentifier) {
      return errorResponse(res, 400, 'Invalid identifier format. Use alphanumeric characters and hyphens.');
    }

    // Check if table identifier already exists
    const existing = await RestaurantTableRepository.findByIdentifier(req.params.tenantId, sanitizedIdentifier);
    if (existing) {
      return errorResponse(res, 409, 'Table with this identifier already exists');
    }

    const tenant = await TenantRepository.findById(req.params.tenantId);
    if (!tenant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    const qrUrl = generateQRUrl(tenant.slug, sanitizedIdentifier);
    const tableId = await RestaurantTableRepository.create({
      tenant_id: req.params.tenantId,
      name,
      identifier: sanitizedIdentifier,
      qr_url: qrUrl
    });

    successResponse(res, 201, { id: tableId, qr_url: qrUrl }, 'Table created successfully');
  } catch (error) {
    console.error('Create table error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Bulk create tables
router.post('/:tenantId/tables/bulk', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { tables } = req.body;

    if (!Array.isArray(tables) || tables.length === 0) {
      return errorResponse(res, 400, 'Tables array is required and must not be empty');
    }

    if (tables.length > 100) {
      return errorResponse(res, 400, 'Maximum 100 tables can be created at once');
    }

    const tenant = await TenantRepository.findById(req.params.tenantId);
    if (!tenant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    const createdTables = [];
    const errors = [];

    for (let i = 0; i < tables.length; i++) {
      const { name, identifier, table_type = 'regular' } = tables[i];

      // Validation
      if (!name || !identifier) {
        errors.push(`Table ${i + 1}: Name and identifier are required`);
        continue;
      }

      // Sanitize identifier
      const sanitizedIdentifier = sanitizeTableIdentifier(identifier);
      
      if (!sanitizedIdentifier) {
        errors.push(`Table ${i + 1}: Invalid identifier format`);
        continue;
      }

      // Check if identifier already exists
      const existing = await RestaurantTableRepository.findByIdentifier(req.params.tenantId, sanitizedIdentifier);
      if (existing) {
        errors.push(`Table ${i + 1}: Identifier "${sanitizedIdentifier}" already exists`);
        continue;
      }

      try {
        const qrUrl = generateQRUrl(tenant.slug, sanitizedIdentifier);
        const tableId = await RestaurantTableRepository.create({
          tenant_id: req.params.tenantId,
          name,
          identifier: sanitizedIdentifier,
          qr_url: qrUrl,
          table_type
        });

        createdTables.push({
          id: tableId,
          name,
          identifier: sanitizedIdentifier,
          qr_url: qrUrl,
          table_type,
          is_active: 1
        });
      } catch (err) {
        errors.push(`Table ${i + 1} (${name}): Failed to create - ${err.message}`);
      }
    }

    // Return response with created tables and any errors
    const response = {
      created: createdTables.length,
      total: tables.length,
      tables: createdTables
    };

    if (errors.length > 0) {
      response.errors = errors;
      response.message = `Created ${createdTables.length} of ${tables.length} tables`;
      successResponse(res, 207, response, response.message);
    } else {
      successResponse(res, 201, response, `All ${createdTables.length} tables created successfully`);
    }
  } catch (error) {
    console.error('Bulk create tables error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update table
router.put('/:tenantId/tables/:tableId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const table = await RestaurantTableRepository.findById(req.params.tableId);
    if (!table || table.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Table not found');
    }

    const { name, identifier, is_active } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (is_active !== undefined) updates.is_active = is_active;

    if (identifier && identifier !== table.identifier) {
      // Sanitize the new identifier
      const sanitizedIdentifier = sanitizeTableIdentifier(identifier);
      
      if (!sanitizedIdentifier) {
        return errorResponse(res, 400, 'Invalid identifier format. Use alphanumeric characters and hyphens.');
      }

      const existing = await RestaurantTableRepository.findByIdentifier(req.params.tenantId, sanitizedIdentifier);
      if (existing) {
        return errorResponse(res, 409, 'Table with this identifier already exists');
      }
      updates.identifier = sanitizedIdentifier;

      const tenant = await TenantRepository.findById(req.params.tenantId);
      updates.qr_url = generateQRUrl(tenant.slug, sanitizedIdentifier);
    }

    await RestaurantTableRepository.updateById(req.params.tableId, updates);
    const updated = await RestaurantTableRepository.findById(req.params.tableId);

    successResponse(res, 200, updated, 'Table updated successfully');
  } catch (error) {
    console.error('Update table error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Deactivate table
router.delete('/:tenantId/tables/:tableId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const table = await RestaurantTableRepository.findById(req.params.tableId);
    if (!table || table.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Table not found');
    }

    await RestaurantTableRepository.deactivate(req.params.tableId);
    successResponse(res, 200, { id: req.params.tableId }, 'Table deactivated successfully');
  } catch (error) {
    console.error('Delete table error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// ===================== MENU CATEGORIES =====================

// Get all categories
router.get('/:tenantId/menu/categories', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const categories = await MenuCategoryRepository.findByTenant(req.params.tenantId);
    successResponse(res, 200, categories);
  } catch (error) {
    console.error('Get categories error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create category
router.post('/:tenantId/menu/categories', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { name, sort_order } = req.body;

    if (!name) {
      return errorResponse(res, 400, 'Category name is required');
    }

    const categoryId = await MenuCategoryRepository.create({
      tenant_id: req.params.tenantId,
      name,
      sort_order: sort_order || 0
    });

    successResponse(res, 201, { id: categoryId }, 'Category created successfully');
  } catch (error) {
    console.error('Create category error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update category
router.put('/:tenantId/menu/categories/:categoryId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const category = await MenuCategoryRepository.findById(req.params.categoryId);
    if (!category || category.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Category not found');
    }

    const { name, sort_order } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (sort_order !== undefined) updates.sort_order = sort_order;

    await MenuCategoryRepository.updateById(req.params.categoryId, updates);
    const updated = await MenuCategoryRepository.findById(req.params.categoryId);

    successResponse(res, 200, updated, 'Category updated successfully');
  } catch (error) {
    console.error('Update category error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Delete category
router.delete('/:tenantId/menu/categories/:categoryId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const category = await MenuCategoryRepository.findById(req.params.categoryId);
    if (!category || category.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Category not found');
    }

    await MenuCategoryRepository.deactivate(req.params.categoryId);
    successResponse(res, 200, { id: req.params.categoryId }, 'Category deleted successfully');
  } catch (error) {
    console.error('Delete category error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// ===================== MENU ITEMS =====================

// Get all menu items
router.get('/:tenantId/menu/items', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const items = await MenuItemRepository.findByTenant(req.params.tenantId);
    successResponse(res, 200, items);
  } catch (error) {
    console.error('Get menu items error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create menu item
router.post('/:tenantId/menu/items', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { category_id, name, description, price, image_url, is_veg, is_spicy, tags, preparation_time } = req.body;

    if (!category_id || !name || price === undefined) {
      return errorResponse(res, 400, 'Category, name, and price are required');
    }

    // Verify category belongs to this tenant
    const category = await MenuCategoryRepository.findById(category_id);
    if (!category || category.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Category not found');
    }

    const itemId = await MenuItemRepository.create({
      tenant_id: req.params.tenantId,
      category_id,
      name,
      description,
      price: parseFloat(price),
      image_url: image_url || null,
      is_veg: is_veg !== undefined ? (is_veg ? 1 : 0) : 1,
      is_spicy: is_spicy !== undefined ? (is_spicy ? 1 : 0) : 0,
      tags: tags || '',
      preparation_time: preparation_time || null
    });

    successResponse(res, 201, { id: itemId }, 'Menu item created successfully');
  } catch (error) {
    console.error('Create menu item error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Bulk create menu items
router.post('/:tenantId/menu/items/bulk', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { items } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 400, 'Items array is required and must not be empty');
    }

    // Validate and create items
    const createdItems = [];
    const errors = [];

    for (let i = 0; i < items.length; i++) {
      const { category_id, name, description, price, image_url, is_veg, is_spicy, tags, preparation_time } = items[i];

      // Validation
      if (!category_id || !name || price === undefined) {
        errors.push(`Item ${i + 1}: Category, name, and price are required`);
        continue;
      }

      try {
        // Verify category belongs to this tenant
        const category = await MenuCategoryRepository.findById(category_id);
        if (!category || category.tenant_id !== req.params.tenantId) {
          errors.push(`Item ${i + 1}: Category not found`);
          continue;
        }

        const itemId = await MenuItemRepository.create({
          tenant_id: req.params.tenantId,
          category_id,
          name,
          description,
          price: parseFloat(price),
          image_url: image_url || null,
          is_veg: is_veg !== undefined ? (is_veg ? 1 : 0) : 1,
          is_spicy: is_spicy !== undefined ? (is_spicy ? 1 : 0) : 0,
          tags: tags || '',
          preparation_time: preparation_time || null
        });

        const createdItem = await MenuItemRepository.findById(itemId);
        createdItems.push(createdItem);
      } catch (itemError) {
        errors.push(`Item ${i + 1}: ${itemError.message}`);
      }
    }

    // Return response with created items and any errors
    if (errors.length > 0) {
      return successResponse(res, 207, { 
        created: createdItems, 
        errors,
        createdCount: createdItems.length,
        errorCount: errors.length
      }, 'Bulk import completed with some errors');
    }

    successResponse(res, 201, createdItems, 'All items created successfully');
  } catch (error) {
    console.error('Bulk create menu items error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update menu item
router.put('/:tenantId/menu/items/:itemId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const item = await MenuItemRepository.findById(req.params.itemId);
    if (!item || item.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Menu item not found');
    }

    const { name, description, price, is_available, image_url } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (price !== undefined) updates.price = parseFloat(price);
    if (is_available !== undefined) updates.is_available = is_available;
    if (image_url !== undefined) updates.image_url = image_url;

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, 400, 'No fields to update');
    }

    await MenuItemRepository.updateById(req.params.itemId, updates);
    const updated = await MenuItemRepository.findById(req.params.itemId);

    successResponse(res, 200, updated, 'Menu item updated successfully');
  } catch (error) {
    console.error('Update menu item error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Deactivate menu item
router.delete('/:tenantId/menu/items/:itemId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const item = await MenuItemRepository.findById(req.params.itemId);
    if (!item || item.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Menu item not found');
    }

    await MenuItemRepository.deactivate(req.params.itemId);
    successResponse(res, 200, { id: req.params.itemId }, 'Menu item deactivated successfully');
  } catch (error) {
    console.error('Delete menu item error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// ===================== IMAGE UPDATE ENDPOINTS =====================

// Auto-update image for a single menu item
router.post('/:tenantId/menu/items/:itemId/auto-update-image', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    // Prevent caching of this endpoint
    res.set({
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'Pragma': 'no-cache',
      'Expires': '0'
    });

    console.log(`🖼️ Auto-update image request for item: ${req.params.itemId}`);
    console.log(`   Tenant ID: ${req.params.tenantId}`);
    console.log(`   User: ${req.user.email} (${req.user.role})`);
    console.log(`   User Tenant: ${req.user.tenantId}`);
    
    const item = await MenuItemRepository.findById(req.params.itemId);
    if (!item) {
      console.log(`❌ Menu item not found: ${req.params.itemId}`);
      return errorResponse(res, 404, 'Menu item not found');
    }
    
    if (item.tenant_id !== req.params.tenantId) {
      console.log(`❌ Tenant mismatch: item.tenant_id=${item.tenant_id}, req.params.tenantId=${req.params.tenantId}`);
      return errorResponse(res, 404, 'Menu item not found');
    }

    console.log(`📝 Found menu item: "${item.name}" (current image: ${item.image_url || 'none'})`);
    console.log(`🔍 Will search Unsplash for: "${item.name}"`);

    const imageUrl = await MenuItemRepository.autoUpdateImage(req.params.itemId, true);
    
    if (imageUrl) {
      console.log(`✅ Image updated successfully: ${imageUrl}`);
      successResponse(res, 200, { 
        id: req.params.itemId, 
        name: item.name,
        image_url: imageUrl 
      }, 'Image updated successfully');
    } else {
      console.log(`⚠️ No suitable image found for: ${item.name}`);
      successResponse(res, 200, { 
        id: req.params.itemId, 
        name: item.name,
        image_url: null 
      }, 'No suitable image found');
    }
  } catch (error) {
    console.error('❌ Auto-update image error:', error);
    console.error('Error stack:', error.stack);
    
    // More specific error detection
    if (error.message.includes('not configured')) {
      return errorResponse(res, 400, 'Image service not configured', 'Please configure UNSPLASH_ACCESS_KEY in environment variables');
    } else if (error.message.includes('placeholder')) {
      return errorResponse(res, 400, 'Invalid API key configuration', 'Please update UNSPLASH_ACCESS_KEY with a real API key from https://unsplash.com/developers');
    } else if (error.message.includes('rate limit')) {
      return errorResponse(res, 429, 'Rate limit exceeded', 'Unsplash API rate limit exceeded (50 requests/hour). Please try again later or upgrade your plan.');
    } else if (error.message.includes('Invalid') && error.message.includes('API key')) {
      return errorResponse(res, 401, 'Invalid API key', 'Unsplash API key is invalid or expired. Please check your configuration.');
    } else if (error.message.includes('access forbidden')) {
      return errorResponse(res, 403, 'API access forbidden', 'Unsplash API key lacks required permissions. Please check your API key.');
    } else if (error.message.includes('timeout')) {
      return errorResponse(res, 408, 'Request timeout', 'Image fetching timed out. Please try again.');
    } else {
      return errorResponse(res, 500, 'Internal server error', error.message);
    }
  }
});

// DEBUG: Check environment configuration
router.get('/:tenantId/debug/image-config', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  const imageService = require('../utils/imageService');
  res.json({
    unsplashConfigured: !!process.env.UNSPLASH_ACCESS_KEY,
    unsplashKeyLength: process.env.UNSPLASH_ACCESS_KEY ? process.env.UNSPLASH_ACCESS_KEY.length : 0,
    unsplashKeyPreview: process.env.UNSPLASH_ACCESS_KEY ? process.env.UNSPLASH_ACCESS_KEY.substring(0, 10) + '...' : 'NOT SET',
    isPlaceholder: process.env.UNSPLASH_ACCESS_KEY === 'your_unsplash_access_key_here',
    serviceConfigured: imageService.isApiKeyConfigured()
  });
});

// Bulk auto-update images for all menu items without images (moved down)
router.post('/:tenantId/menu/bulk-update-images-moved', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    console.log(`🖼️ Bulk image update request for tenant: ${req.params.tenantId}`);
    
    const results = await MenuItemRepository.bulkUpdateMissingImages(req.params.tenantId);
    
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    console.log(`📊 Bulk update completed: ${successful} successful, ${failed} failed`);
    
    successResponse(res, 200, {
      total: results.length,
      successful,
      failed,
      results
    }, `Bulk image update completed: ${successful} successful, ${failed} failed`);
  } catch (error) {
    console.error('❌ Bulk update images error:', error);
    console.error('Error stack:', error.stack);
    
    // More specific error detection
    if (error.message.includes('not configured')) {
      return errorResponse(res, 400, 'Image service not configured', 'Please configure UNSPLASH_ACCESS_KEY in environment variables');
    } else if (error.message.includes('placeholder')) {
      return errorResponse(res, 400, 'Invalid API key configuration', 'Please update UNSPLASH_ACCESS_KEY with a real API key from https://unsplash.com/developers');
    } else if (error.message.includes('rate limit')) {
      return errorResponse(res, 429, 'Rate limit exceeded', 'Unsplash API rate limit exceeded (50 requests/hour). Please try again later or upgrade your plan.');
    } else if (error.message.includes('Invalid') && error.message.includes('API key')) {
      return errorResponse(res, 401, 'Invalid API key', 'Unsplash API key is invalid or expired. Please check your configuration.');
    } else if (error.message.includes('access forbidden')) {
      return errorResponse(res, 403, 'API access forbidden', 'Unsplash API key lacks required permissions. Please check your API key.');
    } else {
      return errorResponse(res, 500, 'Internal server error', error.message);
    }
  }
});

// ===================== ORDERS =====================

// Get all orders for restaurant
router.get('/:tenantId/orders', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.source_type) filters.source_type = req.query.source_type;
    if (req.query.payment_status) filters.payment_status = req.query.payment_status;

    const orders = await OrderRepository.findByTenant(req.params.tenantId, filters);

    // Fetch order items for each order and format timestamps
    const ordersWithItems = await Promise.all(
      orders.map(async (order) => ({
        ...order,
        created_at: formatTimestamp(order.created_at),
        updated_at: formatTimestamp(order.updated_at),
        items: (await OrderItemRepository.findByOrder(order.id)).map(item => ({
          id: item.id,
          order_id: item.order_id,
          menu_item_id: item.menu_item_id,
          name_snapshot: item.name_snapshot,
          price_snapshot: item.price_snapshot,
          quantity: item.quantity,
          status: item.status,
          notes: item.notes || null,
          menuItem: {
            name: item.name_snapshot,
            isVeg: item.is_veg ? true : false,
            isSpicy: item.is_spicy ? true : false
          }
        }))
      }))
    );

    successResponse(res, 200, ordersWithItems);
  } catch (error) {
    console.error('Get orders error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get single order
router.get('/:tenantId/orders/:orderId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const order = await OrderRepository.findById(req.params.orderId);
    if (!order || order.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Order not found');
    }

    const rawItems = await OrderItemRepository.findByOrder(req.params.orderId);
    const items = rawItems.map(item => ({
      id: item.id,
      order_id: item.order_id,
      menu_item_id: item.menu_item_id,
      name_snapshot: item.name_snapshot,
      price_snapshot: item.price_snapshot,
      quantity: item.quantity,
      status: item.status,
      notes: item.notes || null,
      menuItem: {
        name: item.name_snapshot,
        isVeg: item.is_veg ? true : false,
        isSpicy: item.is_spicy ? true : false
      }
    }));

    successResponse(res, 200, {
      ...order,
      created_at: formatTimestamp(order.created_at),
      updated_at: formatTimestamp(order.updated_at),
      items
    });
  } catch (error) {
    console.error('Get order error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update order status
router.patch('/:tenantId/orders/:orderId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const order = await OrderRepository.findById(req.params.orderId);
    if (!order || order.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Order not found');
    }

    const { status, notes } = req.body;

    if (status && !['pending', 'confirmed', 'cooking', 'ready', 'served', 'completed', 'cancelled'].includes(status)) {
      return errorResponse(res, 400, 'Invalid status');
    }

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;

    await OrderRepository.updateById(req.params.orderId, updates);
    const updated = await OrderRepository.findById(req.params.orderId);

    // Emit Socket.io event for real-time updates
    const io = req.app.get('io');
    if (io) {
      // Notify kitchen
      io.to(`kitchen-${req.params.tenantId}`).emit('order-status-updated', {
        orderId: updated.id,
        status: updated.status,
        updatedAt: updated.updated_at
      });
      
      // Notify table
      if (updated.table_id) {
        io.to(`table-${updated.table_id}`).emit('order-status-updated', {
          orderId: updated.id,
          status: updated.status,
          updatedAt: updated.updated_at
        });
      }
      
      // Notify tenant dashboard
      io.to(`tenant-${req.params.tenantId}`).emit('order-updated', {
        orderId: updated.id,
        status: updated.status,
        updatedAt: updated.updated_at
      });
    }

    successResponse(res, 200, updated, 'Order updated successfully');
  } catch (error) {
    console.error('Update order error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update order item status
router.put('/:tenantId/orders/:orderId/items/:itemId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const order = await OrderRepository.findById(req.params.orderId);
    if (!order || order.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Order not found');
    }

    const { status, notes } = req.body;

    // Build the update object
    const updates = {};
    
    if (status) {
      if (!['pending', 'ready', 'completed', 'cancelled'].includes(status)) {
        return errorResponse(res, 400, 'Invalid status');
      }
      updates.status = status;
    }

    if (notes !== undefined) {
      // notes can be empty string or any text, but cap at 500 characters
      const sanitizedNotes = notes ? notes.substring(0, 500) : null;
      updates.notes = sanitizedNotes;
    }

    if (Object.keys(updates).length === 0) {
      return errorResponse(res, 400, 'Either status or notes is required');
    }

    // Update the order item
    await OrderItemRepository.updateById(req.params.itemId, updates);
    
    // Fetch updated order with items
    const items = await OrderItemRepository.findByOrder(req.params.orderId);
    const updated = await OrderRepository.findById(req.params.orderId);

    successResponse(res, 200, { ...updated, items }, 'Order item updated successfully');
  } catch (error) {
    console.error('Update order item error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// ===================== INTEGRATION CONFIG (ZOMATO/SWIGGY) =====================

// Get integration config
router.get('/:tenantId/integration-config/:provider', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { provider } = req.params;
    
    if (!['zomato', 'swiggy'].includes(provider)) {
      return errorResponse(res, 400, 'Invalid provider. Must be zomato or swiggy');
    }

    const config = await IntegrationRepository.findByTenant(req.params.tenantId, provider);
    
    if (config) {
      // Don't expose the API key
      return successResponse(res, 200, {
        id: config.id,
        provider: config.provider,
        webhook_url: config.webhook_url,
        soapie_url: config.soapie_url,
        is_active: config.is_active,
        created_at: config.created_at,
        updated_at: config.updated_at
      });
    }

    successResponse(res, 200, null);
  } catch (error) {
    console.error('Get integration config error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create or update integration config
router.post('/:tenantId/integration-config/:provider', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { provider } = req.params;
    const { webhook_url, soapie_url, api_key, is_active } = req.body;

    if (!['zomato', 'swiggy'].includes(provider)) {
      return errorResponse(res, 400, 'Invalid provider. Must be zomato or swiggy');
    }

    // Validate required fields based on provider
    if (provider === 'zomato' && !webhook_url) {
      return errorResponse(res, 400, 'Webhook URL is required for Zomato');
    }
    if (provider === 'swiggy' && !soapie_url) {
      return errorResponse(res, 400, 'Soapie URL is required for Swiggy');
    }

    const existing = await IntegrationRepository.findByTenant(req.params.tenantId, provider);

    if (existing) {
      // Update
      const updates = {
        is_active: is_active !== undefined ? is_active : existing.is_active
      };
      
      if (provider === 'zomato' && webhook_url) {
        updates.webhook_url = webhook_url;
      }
      if (provider === 'swiggy' && soapie_url) {
        updates.soapie_url = soapie_url;
      }
      if (api_key) {
        updates.api_key = api_key;
      }

      await IntegrationRepository.updateById(existing.id, updates);

      const updated = await IntegrationRepository.findById(existing.id);
      return successResponse(res, 200, {
        id: updated.id,
        provider: updated.provider,
        webhook_url: updated.webhook_url,
        soapie_url: updated.soapie_url,
        is_active: updated.is_active
      }, 'Integration config updated successfully');
    } else {
      // Create
      const configId = await IntegrationRepository.create({
        tenant_id: req.params.tenantId,
        provider,
        webhook_url: provider === 'zomato' ? webhook_url : null,
        soapie_url: provider === 'swiggy' ? soapie_url : null,
        api_key: api_key || null,
        is_active: is_active !== undefined ? is_active : 1
      });

      successResponse(res, 201, {
        id: configId,
        provider,
        is_active: is_active !== undefined ? is_active : 1
      }, 'Integration config created successfully');
    }
  } catch (error) {
    console.error('Create/update integration config error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// ===================== EMAIL CONFIG =====================

// Get email configuration
router.get('/:tenantId/email-config', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const config = await EmailConfigRepository.findByTenant(req.params.tenantId);
    
    if (config) {
      // Don't expose the app password
      return successResponse(res, 200, {
        id: config.id,
        email_address: config.email_address,
        is_active: config.is_active,
        created_at: config.created_at
      });
    }

    successResponse(res, 200, null);
  } catch (error) {
    console.error('Get email config error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create or update email configuration
router.post('/:tenantId/email-config', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { email_address, app_password } = req.body;

    if (!email_address || !app_password) {
      return errorResponse(res, 400, 'Email address and app password are required');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email_address)) {
      return errorResponse(res, 400, 'Invalid email format');
    }

    const existing = await EmailConfigRepository.findByTenant(req.params.tenantId);

    if (existing) {
      // Update
      await EmailConfigRepository.updateById(existing.id, {
        email_address,
        app_password
      });

      const updated = await EmailConfigRepository.findById(existing.id);
      return successResponse(res, 200, {
        id: updated.id,
        email_address: updated.email_address,
        is_active: updated.is_active
      }, 'Email config updated successfully');
    } else {
      // Create
      const configId = await EmailConfigRepository.create({
        tenant_id: req.params.tenantId,
        email_address,
        app_password
      });

      successResponse(res, 201, {
        id: configId,
        email_address
      }, 'Email config created successfully');
    }
  } catch (error) {
    console.error('Create/update email config error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Enable/disable email configuration
router.put('/:tenantId/email-config/:configId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { is_active } = req.body;

    const config = await EmailConfigRepository.findById(req.params.configId);
    if (!config || config.tenant_id !== req.params.tenantId) {
      return errorResponse(res, 404, 'Email config not found');
    }

    await EmailConfigRepository.updateById(req.params.configId, { is_active });

    const updated = await EmailConfigRepository.findById(req.params.configId);
    successResponse(res, 200, {
      id: updated.id,
      email_address: updated.email_address,
      is_active: updated.is_active
    }, 'Email config updated successfully');
  } catch (error) {
    console.error('Update email config error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get dashboard metrics
router.get('/:tenantId/dashboard/metrics', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const tenant = await TenantRepository.findById(req.params.tenantId);
    if (!tenant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    const tables = await RestaurantTableRepository.findByTenant(req.params.tenantId);
    const categories = await MenuCategoryRepository.findByTenant(req.params.tenantId);
    const orders = await OrderRepository.findByTenant(req.params.tenantId);

    const todayOrders = orders.filter(o => {
      const orderDate = new Date(o.created_at).toDateString();
      const today = new Date().toDateString();
      return orderDate === today;
    });

    const totalRevenue = orders
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

    const todayRevenue = todayOrders
      .filter(o => o.payment_status === 'paid')
      .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

    successResponse(res, 200, {
      restaurant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug
      },
      stats: {
        totalTables: tables.length,
        activeTables: tables.filter(t => t.is_active).length,
        totalCategories: categories.length,
        totalOrders: orders.length,
        todayOrders: todayOrders.length,
        totalRevenue: totalRevenue.toFixed(2),
        todayRevenue: todayRevenue.toFixed(2)
      }
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// ===================== REPORTS =====================

// Get revenue report
router.get('/:tenantId/reports/revenue', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { period = 'daily', startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return errorResponse(res, 400, 'Start date and end date are required');
    }

    const report = await ReportsRepository.getRevenueReport(
      req.params.tenantId,
      period,
      startDate,
      endDate
    );

    successResponse(res, 200, report);
  } catch (error) {
    console.error('Get revenue report error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get order report
router.get('/:tenantId/reports/orders', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { startDate, endDate, source_type, status } = req.query;

    if (!startDate || !endDate) {
      return errorResponse(res, 400, 'Start date and end date are required');
    }

    const filters = {};
    if (source_type) filters.source_type = source_type;
    if (status) filters.status = status;

    const report = await ReportsRepository.getOrderReport(
      req.params.tenantId,
      startDate,
      endDate,
      filters
    );

    successResponse(res, 200, report);
  } catch (error) {
    console.error('Get order report error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get product report
router.get('/:tenantId/reports/products', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return errorResponse(res, 400, 'Start date and end date are required');
    }

    const report = await ReportsRepository.getProductReport(
      req.params.tenantId,
      startDate,
      endDate
    );

    successResponse(res, 200, report);
  } catch (error) {
    console.error('Get product report error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

module.exports = router;
