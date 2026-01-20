const express = require('express');
const router = express.Router();
const UserRepository = require('../repositories/UserRepository');
const TenantRepository = require('../repositories/TenantRepository');
const RestaurantTableRepository = require('../repositories/RestaurantTableRepository');
const {
  hashPassword,
  verifyPassword,
  generateToken,
  authenticateToken
} = require('../utils/auth');
const { validateEmail, errorResponse, successResponse } = require('../utils/helpers');

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return errorResponse(res, 400, 'Email and password are required');
    }

    if (!validateEmail(email)) {
      return errorResponse(res, 400, 'Invalid email format');
    }

    const user = await UserRepository.findByEmail(email);
    if (!user) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return errorResponse(res, 401, 'Invalid credentials');
    }

    const token = generateToken(user.id, user.email, user.role, user.tenant_id);

    const tenantInfo = user.tenant_id 
      ? await TenantRepository.findById(user.tenant_id)
      : null;

    successResponse(res, 200, {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        tenantId: user.tenant_id,
        tenant: tenantInfo
      }
    }, 'Login successful');
  } catch (error) {
    console.error('Login error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create first superadmin (development/initialization only)
router.post('/init-superadmin', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return errorResponse(res, 400, 'Email, password, and name are required');
    }

    if (!validateEmail(email)) {
      return errorResponse(res, 400, 'Invalid email format');
    }

    // Check if superadmin already exists
    const existingUser = await UserRepository.findByEmail(email);
    if (existingUser) {
      return errorResponse(res, 409, 'User with this email already exists');
    }

    const passwordHash = await hashPassword(password);
    const userId = await UserRepository.create({
      tenant_id: null,
      email,
      password_hash: passwordHash,
      name,
      role: 'superadmin'
    });

    const token = generateToken(userId, email, 'superadmin', null);

    successResponse(res, 201, { token, userId }, 'Superadmin created successfully');
  } catch (error) {
    console.error('Init superadmin error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get current user
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const user = await UserRepository.findById(req.user.userId);
    if (!user) {
      return errorResponse(res, 404, 'User not found');
    }

    const tenantInfo = user.tenant_id
      ? await TenantRepository.findById(user.tenant_id)
      : null;

    successResponse(res, 200, {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenant_id,
      tenant: tenantInfo
    });
  } catch (error) {
    console.error('Get me error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Validate QR code token
router.post('/validate-qr', async (req, res) => {
  try {
    const { restaurantId, tableId, qrToken } = req.body;

    if (!restaurantId || !tableId || !qrToken) {
      return errorResponse(res, 400, 'Missing required QR code parameters');
    }

    // Find restaurant by ID or slug
    const tenant = await TenantRepository.findById(restaurantId) || await TenantRepository.findBySlug(restaurantId);
    if (!tenant) {
      return errorResponse(res, 404, 'Restaurant not found');
    }

    // Find table by ID or identifier
    const table = await RestaurantTableRepository.findById(tableId) || await RestaurantTableRepository.findByIdentifier(tenant.id, tableId);
    if (!table) {
      return errorResponse(res, 404, 'Table not found');
    }

    // For now, we accept any valid QR token format (can add more validation later)
    // The QR token is used to verify the table access
    if (!qrToken || qrToken.length === 0) {
      return errorResponse(res, 401, 'Invalid QR token');
    }

    successResponse(res, 200, {
      valid: true,
      tableName: table.name,
      restaurantId: tenant.id,
      tableId: table.id
    });
  } catch (error) {
    console.error('Validate QR error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

module.exports = router;
