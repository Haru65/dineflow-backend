const express = require('express');
const router = express.Router();
const TenantRepository = require('../repositories/TenantRepository');
const UserRepository = require('../repositories/UserRepository');
const { dbGet, dbRun, dbAll } = require('../database');
const {
  authenticateToken,
  authorizeSuperadmin,
  hashPassword,
  generateToken
} = require('../utils/auth');
const {
  generateId,
  validateEmail,
  errorResponse,
  successResponse
} = require('../utils/helpers');
const { createDefaultCategories } = require('../utils/defaultCategories');

// Get all tenants
router.get('/tenants', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const tenants = await TenantRepository.findAll();
    successResponse(res, 200, tenants);
  } catch (error) {
    console.error('Get tenants error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get tenant details
router.get('/tenants/:id', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const tenant = await TenantRepository.findById(req.params.id);
    if (!tenant) {
      return errorResponse(res, 404, 'Tenant not found');
    }

    const users = await UserRepository.findByTenant(req.params.id);
    
    // Get the restaurant admin user (without password hash)
    const adminUser = users.find(u => u.role === 'restaurant_admin');
    const admin = adminUser ? {
      id: adminUser.id,
      name: adminUser.name,
      email: adminUser.email,
      role: adminUser.role
    } : null;

    successResponse(res, 200, {
      ...tenant,
      admin,
      users
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create tenant
router.post('/tenants', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const { name, address, contact_phone, adminEmail, adminPassword, adminName } = req.body;

    if (!name || !adminEmail || !adminPassword || !adminName) {
      return errorResponse(res, 400, 'Name, admin email, password, and name are required');
    }

    if (!validateEmail(adminEmail)) {
      return errorResponse(res, 400, 'Invalid email format');
    }

    // Check if email already exists
    const existingUser = await UserRepository.findByEmail(adminEmail);
    if (existingUser) {
      return errorResponse(res, 409, 'User with this email already exists');
    }

    // Create tenant
    const { id: tenantId, slug } = await TenantRepository.create({
      name,
      address,
      contact_phone
    });

    // Create restaurant admin
    const passwordHash = await hashPassword(adminPassword);
    const adminId = await UserRepository.create({
      tenant_id: tenantId,
      email: adminEmail,
      password_hash: passwordHash,
      name: adminName,
      role: 'restaurant_admin'
    });

    // Create default categories for the tenant
    const defaultCategoryIds = await createDefaultCategories(tenantId);

    successResponse(res, 201, {
      tenantId,
      slug,
      adminId,
      adminEmail,
      defaultCategories: defaultCategoryIds
    }, 'Tenant, admin, and default categories created successfully');
  } catch (error) {
    console.error('Create tenant error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update tenant
router.put('/tenants/:id', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const tenant = await TenantRepository.findById(req.params.id);
    if (!tenant) {
      return errorResponse(res, 404, 'Tenant not found');
    }

    const { name, address, contact_phone, adminPassword, adminEmail, adminName } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (address) updates.address = address;
    if (contact_phone) updates.contact_phone = contact_phone;

    await TenantRepository.updateById(req.params.id, updates);

    // Update admin user if credentials provided
    if (adminPassword || adminEmail || adminName) {
      const users = await UserRepository.findByTenant(req.params.id);
      const adminUser = users.find(u => u.role === 'restaurant_admin');
      
      if (adminUser) {
        const adminUpdates = {};
        if (adminName) adminUpdates.name = adminName;
        if (adminEmail) {
          // Check if email already exists for another user
          const existingUser = await UserRepository.findByEmail(adminEmail);
          if (existingUser && existingUser.id !== adminUser.id) {
            return errorResponse(res, 409, 'Email already in use by another user');
          }
          adminUpdates.email = adminEmail;
        }
        if (adminPassword) {
          adminUpdates.password_hash = await hashPassword(adminPassword);
        }
        
        if (Object.keys(adminUpdates).length > 0) {
          await UserRepository.updateById(adminUser.id, adminUpdates);
        }
      }
    }

    const updated = await TenantRepository.findById(req.params.id);
    successResponse(res, 200, updated, 'Tenant updated successfully');
  } catch (error) {
    console.error('Update tenant error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Delete tenant (soft delete - deactivates instead of removing)
router.delete('/tenants/:id', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const tenant = await TenantRepository.findById(req.params.id);
    if (!tenant) {
      return errorResponse(res, 404, 'Tenant not found');
    }

    await TenantRepository.deleteById(req.params.id);
    successResponse(res, 200, { id: req.params.id }, 'Tenant deactivated successfully (soft delete)');
  } catch (error) {
    console.error('Delete tenant error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Restore tenant (reactivate soft-deleted tenant)
router.post('/tenants/:id/restore', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    // Check if tenant exists (including inactive ones)
    const tenant = await dbGet('SELECT * FROM tenants WHERE id = ?', [req.params.id]);
    if (!tenant) {
      return errorResponse(res, 404, 'Tenant not found');
    }

    if (tenant.is_active) {
      return errorResponse(res, 400, 'Tenant is already active');
    }

    // Restore tenant
    await dbRun('UPDATE tenants SET is_active = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [req.params.id]);
    successResponse(res, 200, { id: req.params.id }, 'Tenant restored successfully');
  } catch (error) {
    console.error('Restore tenant error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get all tenants including inactive ones (for superadmin)
router.get('/tenants/all', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const tenants = await dbAll('SELECT * FROM tenants ORDER BY created_at DESC');
    successResponse(res, 200, tenants);
  } catch (error) {
    console.error('Get all tenants error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Get superadmin dashboard metrics
router.get('/dashboard/metrics', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const tenants = await TenantRepository.findAll();
    const totalTenants = tenants.length;

    successResponse(res, 200, {
      totalTenants,
      tenants: tenants.map(t => ({
        id: t.id,
        name: t.name,
        slug: t.slug,
        createdAt: t.created_at
      }))
    });
  } catch (error) {
    console.error('Dashboard metrics error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

module.exports = router;
