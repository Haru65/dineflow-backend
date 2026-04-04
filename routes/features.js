/**
 * New Features Routes
 * Offers, Receptionist QR, Quick Actions, Menu Item Editing
 */

const express = require('express');
const router = express.Router();
const {
  authenticateToken,
  authorizeRestaurantAdmin
} = require('../utils/auth');
const {
  generateId,
  sanitizeTableIdentifier,
  errorResponse,
  successResponse
} = require('../utils/helpers');
const OffersRepository = require('../repositories/OffersRepository');
const ComboRepository = require('../repositories/ComboRepository');
const ReceptionistQRRepository = require('../repositories/ReceptionistQRRepository');
const QuickActionsRepository = require('../repositories/QuickActionsRepository');
const MenuItemRepository = require('../repositories/MenuItemRepository');
const TenantRepository = require('../repositories/TenantRepository');

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

// ===================== OFFERS =====================

// Get all offers for restaurant
router.get('/:tenantId/offers', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const offers = await OffersRepository.findByTenant(req.params.tenantId);
    successResponse(res, 200, offers);
  } catch (error) {
    console.error('Get offers error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get active offers for customer view
router.get('/:tenantId/offers/active', async (req, res) => {
  try {
    const offers = await OffersRepository.findActiveByTenant(req.params.tenantId);
    successResponse(res, 200, offers);
  } catch (error) {
    console.error('Get active offers error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create offer
router.post('/:tenantId/offers', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { title, description, discount_percentage, discount_amount, valid_from, valid_until } = req.body;

    if (!title) {
      return errorResponse(res, 400, 'Offer title is required');
    }

    if (!discount_percentage && !discount_amount) {
      return errorResponse(res, 400, 'Either discount_percentage or discount_amount is required');
    }

    const offerId = await OffersRepository.create({
      tenant_id: req.params.tenantId,
      title,
      description,
      discount_percentage,
      discount_amount,
      valid_from,
      valid_until
    });

    const offer = await OffersRepository.findById(offerId);
    successResponse(res, 201, offer, 'Offer created successfully');
  } catch (error) {
    console.error('Create offer error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update offer
router.put('/:tenantId/offers/:offerId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { offerId } = req.params;
    const { title, description, discount_percentage, discount_amount, valid_from, valid_until, is_active } = req.body;

    const offer = await OffersRepository.findById(offerId);
    if (!offer) {
      return errorResponse(res, 404, 'Offer not found');
    }

    await OffersRepository.updateById(offerId, {
      title: title || offer.title,
      description: description !== undefined ? description : offer.description,
      discount_percentage: discount_percentage !== undefined ? discount_percentage : offer.discount_percentage,
      discount_amount: discount_amount !== undefined ? discount_amount : offer.discount_amount,
      valid_from: valid_from || offer.valid_from,
      valid_until: valid_until || offer.valid_until,
      is_active: is_active !== undefined ? is_active : offer.is_active
    });

    const updated = await OffersRepository.findById(offerId);
    successResponse(res, 200, updated, 'Offer updated successfully');
  } catch (error) {
    console.error('Update offer error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Delete offer
router.delete('/:tenantId/offers/:offerId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { offerId } = req.params;

    const offer = await OffersRepository.findById(offerId);
    if (!offer) {
      return errorResponse(res, 404, 'Offer not found');
    }

    await OffersRepository.deleteById(offerId);
    successResponse(res, 200, {}, 'Offer deleted successfully');
  } catch (error) {
    console.error('Delete offer error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// ===================== RECEPTIONIST QR =====================

// Get all receptionist QRs
router.get('/:tenantId/receptionist-qr', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const qrs = await ReceptionistQRRepository.findByTenant(req.params.tenantId);
    successResponse(res, 200, qrs);
  } catch (error) {
    console.error('Get receptionist QR error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create receptionist QR
router.post('/:tenantId/receptionist-qr', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { name, identifier } = req.body;

    if (!name || !identifier) {
      return errorResponse(res, 400, 'Name and identifier are required');
    }

    const sanitizedIdentifier = sanitizeTableIdentifier(identifier);
    if (!sanitizedIdentifier) {
      return errorResponse(res, 400, 'Invalid identifier format');
    }

    // Check if already exists
    const existing = await ReceptionistQRRepository.findByIdentifier(req.params.tenantId, sanitizedIdentifier);
    if (existing) {
      return errorResponse(res, 409, 'Receptionist QR with this identifier already exists');
    }

    const qrId = await ReceptionistQRRepository.create({
      tenant_id: req.params.tenantId,
      name,
      identifier: sanitizedIdentifier
    });

    const qr = await ReceptionistQRRepository.findById(qrId);
    successResponse(res, 201, qr, 'Receptionist QR created successfully');
  } catch (error) {
    console.error('Create receptionist QR error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update receptionist QR
router.put('/:tenantId/receptionist-qr/:qrId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { qrId } = req.params;
    const { name, is_active } = req.body;

    const qr = await ReceptionistQRRepository.findById(qrId);
    if (!qr) {
      return errorResponse(res, 404, 'Receptionist QR not found');
    }

    await ReceptionistQRRepository.updateById(qrId, {
      name: name || qr.name,
      is_active: is_active !== undefined ? is_active : qr.is_active
    });

    const updated = await ReceptionistQRRepository.findById(qrId);
    successResponse(res, 200, updated, 'Receptionist QR updated successfully');
  } catch (error) {
    console.error('Update receptionist QR error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Delete receptionist QR
router.delete('/:tenantId/receptionist-qr/:qrId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { qrId } = req.params;

    const qr = await ReceptionistQRRepository.findById(qrId);
    if (!qr) {
      return errorResponse(res, 404, 'Receptionist QR not found');
    }

    await ReceptionistQRRepository.deleteById(qrId);
    successResponse(res, 200, {}, 'Receptionist QR deleted successfully');
  } catch (error) {
    console.error('Delete receptionist QR error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// ===================== QUICK ACTIONS =====================

// Get all quick actions
router.get('/:tenantId/quick-actions', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const actions = await QuickActionsRepository.findByTenant(req.params.tenantId);
    successResponse(res, 200, actions);
  } catch (error) {
    console.error('Get quick actions error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create quick action
router.post('/:tenantId/quick-actions', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { name, icon, price, sort_order } = req.body;

    if (!name || price === undefined) {
      return errorResponse(res, 400, 'Name and price are required');
    }

    const actionId = await QuickActionsRepository.create({
      tenant_id: req.params.tenantId,
      name,
      icon,
      price,
      sort_order: sort_order || 0
    });

    const action = await QuickActionsRepository.findById(actionId);
    successResponse(res, 201, action, 'Quick action created successfully');
  } catch (error) {
    console.error('Create quick action error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update quick action
router.put('/:tenantId/quick-actions/:actionId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { actionId } = req.params;
    const { name, icon, price, is_active, sort_order } = req.body;

    const action = await QuickActionsRepository.findById(actionId);
    if (!action) {
      return errorResponse(res, 404, 'Quick action not found');
    }

    await QuickActionsRepository.updateById(actionId, {
      name: name || action.name,
      icon: icon !== undefined ? icon : action.icon,
      price: price !== undefined ? price : action.price,
      is_active: is_active !== undefined ? is_active : action.is_active,
      sort_order: sort_order !== undefined ? sort_order : action.sort_order
    });

    const updated = await QuickActionsRepository.findById(actionId);
    successResponse(res, 200, updated, 'Quick action updated successfully');
  } catch (error) {
    console.error('Update quick action error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Delete quick action
router.delete('/:tenantId/quick-actions/:actionId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { actionId } = req.params;

    const action = await QuickActionsRepository.findById(actionId);
    if (!action) {
      return errorResponse(res, 404, 'Quick action not found');
    }

    await QuickActionsRepository.deleteById(actionId);
    successResponse(res, 200, {}, 'Quick action deleted successfully');
  } catch (error) {
    console.error('Delete quick action error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

module.exports = router;


// ===================== COMBO OFFERS =====================

// Get all combos for restaurant
router.get('/:tenantId/combos', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const combos = await ComboRepository.findByTenant(req.params.tenantId);
    successResponse(res, 200, combos);
  } catch (error) {
    console.error('Get combos error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get active combos for customer view
router.get('/:tenantId/combos/active', async (req, res) => {
  try {
    const combos = await ComboRepository.findActiveByTenant(req.params.tenantId);
    successResponse(res, 200, combos);
  } catch (error) {
    console.error('Get active combos error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create combo offer
router.post('/:tenantId/combos', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { name, description, combo_price, image_url, valid_from, valid_until, items } = req.body;

    if (!name || !combo_price) {
      return errorResponse(res, 400, 'Name and combo price are required');
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return errorResponse(res, 400, 'At least one menu item is required');
    }

    // Calculate original price from items
    const original_price = await ComboRepository.calculateOriginalPrice(items);

    // Create combo
    const comboId = await ComboRepository.create({
      tenant_id: req.params.tenantId,
      name,
      description,
      combo_price: parseFloat(combo_price),
      original_price,
      image_url,
      valid_from,
      valid_until
    });

    // Add items to combo
    await ComboRepository.addItems(comboId, items);

    // Fetch complete combo with items
    const combo = await ComboRepository.findById(comboId);

    successResponse(res, 201, combo, 'Combo created successfully');
  } catch (error) {
    console.error('Create combo error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update combo offer
router.put('/:tenantId/combos/:comboId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { comboId } = req.params;
    const { name, description, combo_price, image_url, valid_from, valid_until, is_active, items } = req.body;

    const combo = await ComboRepository.findById(comboId);
    if (!combo) {
      return errorResponse(res, 404, 'Combo not found');
    }

    // If items are being updated, recalculate original price
    let original_price = combo.original_price;
    if (items && Array.isArray(items)) {
      original_price = await ComboRepository.calculateOriginalPrice(items);
      
      // Delete old items and add new ones
      await ComboRepository.deleteItems(comboId);
      await ComboRepository.addItems(comboId, items);
    }

    // Update combo
    await ComboRepository.updateById(comboId, {
      name: name || combo.name,
      description: description !== undefined ? description : combo.description,
      combo_price: combo_price ? parseFloat(combo_price) : combo.combo_price,
      original_price,
      image_url: image_url !== undefined ? image_url : combo.image_url,
      valid_from: valid_from !== undefined ? valid_from : combo.valid_from,
      valid_until: valid_until !== undefined ? valid_until : combo.valid_until,
      is_active: is_active !== undefined ? is_active : combo.is_active
    });

    // Fetch updated combo
    const updated = await ComboRepository.findById(comboId);

    successResponse(res, 200, updated, 'Combo updated successfully');
  } catch (error) {
    console.error('Update combo error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Delete combo offer
router.delete('/:tenantId/combos/:comboId', authenticateToken, authorizeRestaurantAdmin, verifyTenantAccess, async (req, res) => {
  try {
    const { comboId } = req.params;

    const combo = await ComboRepository.findById(comboId);
    if (!combo) {
      return errorResponse(res, 404, 'Combo not found');
    }

    await ComboRepository.deleteById(comboId);

    successResponse(res, 200, {}, 'Combo deleted successfully');
  } catch (error) {
    console.error('Delete combo error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});
