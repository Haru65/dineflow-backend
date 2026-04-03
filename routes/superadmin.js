const express = require('express');
const router = express.Router();
const multer = require('multer');
const TenantRepository = require('../repositories/TenantRepository');
const UserRepository = require('../repositories/UserRepository');
const PaymentProviderRepository = require('../repositories/PaymentProviderRepository');
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

// Configure multer for logo uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
    }
  }
});

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

// Create tenant with optional logo
router.post('/tenants', authenticateToken, authorizeSuperadmin, upload.single('logo'), async (req, res) => {
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

    // Handle logo upload if provided
    let logoUrl = null;
    if (req.file) {
      // Convert image to base64 data URL
      const base64Image = req.file.buffer.toString('base64');
      logoUrl = `data:${req.file.mimetype};base64,${base64Image}`;
    }

    // Create tenant
    const { id: tenantId, slug } = await TenantRepository.create({
      name,
      address,
      contact_phone,
      logo_url: logoUrl
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
      logoUrl,
      defaultCategories: defaultCategoryIds
    }, 'Tenant, admin, and default categories created successfully');
  } catch (error) {
    console.error('Create tenant error:', error);
    if (error.message.includes('Invalid file type')) {
      return errorResponse(res, 400, 'Invalid file type', error.message);
    }
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Update tenant with optional logo
router.put('/tenants/:id', authenticateToken, authorizeSuperadmin, upload.single('logo'), async (req, res) => {
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

    // Handle logo upload if provided
    if (req.file) {
      const base64Image = req.file.buffer.toString('base64');
      updates.logo_url = `data:${req.file.mimetype};base64,${base64Image}`;
    }

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
    if (error.message.includes('Invalid file type')) {
      return errorResponse(res, 400, 'Invalid file type', error.message);
    }
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Delete tenant (caution: cascades)
router.delete('/tenants/:id', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const tenant = await TenantRepository.findById(req.params.id);
    if (!tenant) {
      return errorResponse(res, 404, 'Tenant not found');
    }

    await TenantRepository.deleteById(req.params.id);
    successResponse(res, 200, { id: req.params.id }, 'Tenant deleted successfully');
  } catch (error) {
    console.error('Delete tenant error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Pause tenant access
router.patch('/tenants/:id/pause', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const tenant = await TenantRepository.findById(req.params.id);
    if (!tenant) {
      return errorResponse(res, 404, 'Tenant not found');
    }

    await TenantRepository.updateById(req.params.id, { is_active: 0 });
    const updated = await TenantRepository.findById(req.params.id);
    successResponse(res, 200, updated, 'Tenant paused successfully');
  } catch (error) {
    console.error('Pause tenant error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Resume tenant access
router.patch('/tenants/:id/resume', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    console.log(`\n🔄 [RESUME] Attempting to resume tenant: ${req.params.id}`);
    
    const tenant = await TenantRepository.findById(req.params.id);
    if (!tenant) {
      console.log(`❌ [RESUME] Tenant not found: ${req.params.id}`);
      return errorResponse(res, 404, 'Tenant not found');
    }

    console.log(`📊 [RESUME] Current tenant state:`, { 
      id: tenant.id, 
      name: tenant.name,
      is_active: tenant.is_active 
    });

    console.log(`✅ [RESUME] Calling updateById with { is_active: 1 }`);
    
    try {
      await TenantRepository.updateById(req.params.id, { is_active: 1 });
      console.log(`✅ [RESUME] Update query executed successfully`);
    } catch (updateError) {
      console.error(`❌ [RESUME] Update query failed:`, updateError.message);
      console.error(`❌ [RESUME] Stack:`, updateError.stack);
      throw updateError;
    }

    const updated = await TenantRepository.findById(req.params.id);
    console.log(`✅ [RESUME] Tenant resumed successfully, new is_active: ${updated.is_active}`);
    
    successResponse(res, 200, updated, 'Tenant resumed successfully');
  } catch (error) {
    console.error(`❌ [RESUME] Fatal error:`, error.message);
    console.error(`❌ [RESUME] Error type:`, error.constructor.name);
    console.error(`❌ [RESUME] Full error:`, error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Migration: Add is_active column to tenants table if missing
router.post('/migrations/add-is-active-column', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    console.log('\n🔄 [MIGRATION-ENDPOINT] Running is_active column migration...');
    const { dbRun, dbGet } = require('../database-postgres');

    // Check if column already exists
    console.log('[MIGRATION-ENDPOINT] Checking if is_active column exists...');
    const columnExists = await dbGet(
      `SELECT column_name FROM information_schema.columns 
       WHERE table_name = 'tenants' AND column_name = 'is_active'`
    );

    if (columnExists) {
      console.log('✅ [MIGRATION-ENDPOINT] is_active column already exists');
      return successResponse(res, 200, {
        status: 'skipped',
        message: 'is_active column already exists'
      });
    }

    // Add the column
    console.log('[MIGRATION-ENDPOINT] Adding is_active column to tenants table...');
    await dbRun(`
      ALTER TABLE tenants 
      ADD COLUMN is_active INTEGER DEFAULT 1
    `);
    console.log('✅ [MIGRATION-ENDPOINT] Column added successfully');

    // Set all existing tenants to active
    await dbRun(`
      UPDATE tenants SET is_active = 1 WHERE is_active IS NULL
    `);
    console.log('✅ [MIGRATION-ENDPOINT] All tenants set to active');

    successResponse(res, 200, {
      status: 'success',
      message: 'is_active column added and all tenants set to active'
    });

  } catch (error) {
    console.error('❌ [MIGRATION-ENDPOINT] Error:', error.message);
    if (error.message.includes('already exists')) {
      return successResponse(res, 200, {
        status: 'skipped',
        message: 'Column already exists'
      });
    }
    errorResponse(res, 500, 'Migration failed', error.message);
  }
});

// Migration: Fix all paused tenants to active
router.post('/migrate-tenant-status', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    console.log('\n🔄 [MIGRATE] Starting tenant status migration...');
    const { dbRun, dbAll } = require('../database-postgres');
    
    // Get all tenants
    console.log('[MIGRATE] Querying all tenants...');
    const tenants = await dbAll('SELECT id, name, is_active FROM tenants');
    console.log(`📊 [MIGRATE] Found ${tenants.length} tenants`);

    const pausedCount = tenants.filter(t => !t.is_active).length;
    console.log(`   ${pausedCount} are paused (is_active = 0 or NULL)`);
    console.log(`   ${tenants.length - pausedCount} are active (is_active = 1)`);

    // Update all paused tenants to active
    if (pausedCount > 0) {
      console.log(`\n✅ [MIGRATE] Setting all ${pausedCount} paused tenants to active...`);
      try {
        await dbRun('UPDATE tenants SET is_active = 1 WHERE is_active = 0 OR is_active IS NULL');
        console.log(`✅ [MIGRATE] Update query executed successfully`);
      } catch (updateError) {
        console.error(`❌ [MIGRATE] Update failed:`, updateError.message);
        throw updateError;
      }
    }

    // Get updated counts
    console.log('[MIGRATE] Verifying migration...');
    const updatedTenants = await dbAll('SELECT id, is_active FROM tenants');
    const nowActive = updatedTenants.filter(t => t.is_active).length;

    console.log(`✅ [MIGRATE] Complete: ${nowActive}/${updatedTenants.length} tenants are now active`);

    successResponse(res, 200, {
      total_tenants: updatedTenants.length,
      now_active: nowActive,
      fixed_count: pausedCount
    }, `Migration complete: ${pausedCount} tenants activated`);

  } catch (error) {
    console.error(`❌ [MIGRATE] Migration error:`, error.message);
    console.error(`❌ [MIGRATE] Error type:`, error.constructor.name);
    console.error(`❌ [MIGRATE] Stack:`, error.stack);
    errorResponse(res, 500, 'Migration failed', error.message);
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

// ===================== PAYMENT CONFIGURATION (SuperAdmin Only) =====================

// Get payment provider config for a tenant
router.get('/tenants/:tenantId/payment-config', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const provider = req.query.provider || 'razorpay'; // Default to razorpay for backward compatibility
    
    // Verify tenant exists
    const tenant = await TenantRepository.findById(req.params.tenantId);
    if (!tenant) {
      return errorResponse(res, 404, 'Tenant not found');
    }

    const config = await PaymentProviderRepository.findByTenant(req.params.tenantId, provider);
    
    if (config) {
      // Don't expose the full secret, return masked version
      const maskedSecret = config.key_secret 
        ? config.key_secret.substring(0, 10) + '***'
        : null;
      
      return successResponse(res, 200, {
        id: config.id,
        provider: config.provider,
        key_id: config.key_id,
        key_secret: maskedSecret,
        webhook_secret: config.webhook_secret,
        website: config.website || 'WEBSTAGING',
        is_active: config.is_active,
        created_at: config.created_at
      });
    }

    successResponse(res, 200, null);
  } catch (error) {
    console.error('Get payment config error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// Create or update payment provider config for a tenant
router.post('/tenants/:tenantId/payment-config', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const { provider = 'razorpay', key_id, key_secret, webhook_secret, website } = req.body;

    // Verify tenant exists
    const tenant = await TenantRepository.findById(req.params.tenantId);
    if (!tenant) {
      return errorResponse(res, 404, 'Tenant not found');
    }

    if (!key_id || !key_secret) {
      return errorResponse(res, 400, 'Key ID and key secret are required');
    }

    if (!['razorpay', 'paytm'].includes(provider)) {
      return errorResponse(res, 400, 'Invalid payment provider');
    }

    const existing = await PaymentProviderRepository.findByTenant(req.params.tenantId, provider);

    if (existing) {
      // Update
      const updates = {
        key_id,
        key_secret,
        webhook_secret: webhook_secret || existing.webhook_secret
      };
      
      if (provider === 'paytm' && website) {
        updates.website = website;
      }

      await PaymentProviderRepository.updateById(existing.id, updates);

      const updated = await PaymentProviderRepository.findById(existing.id);
      return successResponse(res, 200, {
        id: updated.id,
        provider: updated.provider,
        key_id: updated.key_id,
        is_active: updated.is_active
      }, `${provider} config updated successfully`);
    } else {
      // Create
      const configData = {
        tenant_id: req.params.tenantId,
        provider,
        key_id,
        key_secret,
        webhook_secret
      };
      
      if (provider === 'paytm' && website) {
        configData.website = website;
      }

      const configId = await PaymentProviderRepository.create(configData);

      successResponse(res, 201, {
        id: configId,
        provider,
        key_id
      }, `${provider} config created successfully`);
    }
  } catch (error) {
    console.error('Create/update payment config error:', error);
    errorResponse(res, 500, 'Internal server error', error.message);
  }
});

// ===================== TEMPORARY MIGRATION ENDPOINT =====================
// Run this once to add logo_url column, then you can remove this endpoint

router.post('/migrate-logo-column', authenticateToken, authorizeSuperadmin, async (req, res) => {
  try {
    const { dbRun, dbGet } = require('../database-postgres');
    
    console.log('🔄 Checking if logo_url column exists...');
    
    // Check if column already exists
    const checkResult = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tenants' AND column_name = 'logo_url'
    `);
    
    if (checkResult) {
      console.log('✅ Column already exists');
      return successResponse(res, 200, { 
        status: 'already_exists',
        message: 'logo_url column already exists in tenants table',
        columnExists: true
      });
    }
    
    console.log('📝 Adding logo_url column to tenants table...');
    
    // Add the column
    await dbRun('ALTER TABLE tenants ADD COLUMN logo_url TEXT');
    
    console.log('✅ Column added successfully');
    
    // Verify it was added
    const verifyResult = await dbGet(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tenants' AND column_name = 'logo_url'
    `);
    
    if (verifyResult) {
      console.log('✅ Verification successful');
      return successResponse(res, 200, { 
        status: 'success',
        message: 'logo_url column added successfully to tenants table',
        columnExists: true,
        migrationCompleted: true
      });
    } else {
      console.error('❌ Verification failed');
      return errorResponse(res, 500, 'Column added but verification failed');
    }
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    
    // Check if error is because column already exists
    if (error.message && error.message.includes('already exists')) {
      return successResponse(res, 200, { 
        status: 'already_exists',
        message: 'logo_url column already exists in tenants table',
        columnExists: true
      });
    }
    
    return errorResponse(res, 500, 'Migration failed', error.message);
  }
});

module.exports = router;
