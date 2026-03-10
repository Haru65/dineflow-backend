require('dotenv').config();
const { initializeDatabase } = require('./database-postgres');
const TenantRepository = require('./repositories/TenantRepository');
const PaymentProviderRepository = require('./repositories/PaymentProviderRepository');

async function fixPaytmSetup() {
  try {
    console.log('🔧 Fixing Paytm setup and order constraints...');
    
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Step 1: Fix order status constraint
    console.log('\n📋 Step 1: Fixing order status constraint...');
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
    
    const client = await pool.connect();
    
    try {
      // Drop existing constraint
      await client.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check');
      
      // Add new constraint with draft support
      await client.query(`
        ALTER TABLE orders ADD CONSTRAINT orders_status_check 
        CHECK (status IN ('draft', 'pending', 'confirmed', 'cooking', 'ready', 'served', 'cancelled'))
      `);
      
      console.log('✅ Order status constraint fixed');
    } catch (constraintError) {
      console.log('⚠️  Constraint fix skipped (may already be fixed):', constraintError.message);
    }
    
    client.release();
    await pool.end();

    // Step 2: Find the restaurant
    console.log('\n📋 Step 2: Setting up Paytm configuration...');
    const tenant = await TenantRepository.findBySlug('the-shubham-cafe');
    if (!tenant) {
      console.log('❌ Restaurant not found');
      return;
    }
    console.log('✅ Restaurant found:', tenant.name);

    // Step 3: Check if Paytm config exists
    let paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    
    if (!paytmConfig) {
      console.log('📝 Creating Paytm configuration...');
      
      // Create Paytm configuration with staging credentials
      const configData = {
        tenant_id: tenant.id,
        provider: 'paytm',
        key_id: process.env.PAYTM_MID || 'STAGING_MID_PLACEHOLDER',
        key_secret: process.env.PAYTM_KEY || 'STAGING_KEY_PLACEHOLDER',
        webhook_secret: null,
        is_active: 1
      };

      const configId = await PaymentProviderRepository.create(configData);
      console.log('✅ Paytm configuration created:', configId);
      
      paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    } else {
      console.log('✅ Paytm configuration already exists');
    }

    // Step 4: Validate configuration
    console.log('\n📋 Step 3: Validating configuration...');
    console.log('- Provider:', paytmConfig.provider);
    console.log('- Merchant ID:', paytmConfig.key_id);
    console.log('- Key (masked):', paytmConfig.key_secret.substring(0, 8) + '...');
    console.log('- Status:', paytmConfig.is_active ? 'Active' : 'Inactive');

    // Step 5: Environment variables check
    console.log('\n📋 Step 4: Environment variables check...');
    const requiredEnvVars = ['PAYTM_MID', 'PAYTM_KEY', 'PAYTM_WEBSITE'];
    let envIssues = [];
    
    for (const envVar of requiredEnvVars) {
      if (!process.env[envVar] || process.env[envVar].includes('PLACEHOLDER')) {
        envIssues.push(envVar);
      }
    }
    
    if (envIssues.length > 0) {
      console.log('⚠️  Missing or placeholder environment variables:');
      envIssues.forEach(env => console.log(`   - ${env}`));
      console.log('\n📝 To fix on Render:');
      console.log('1. Go to Render Dashboard → Your Service → Environment');
      console.log('2. Add these variables:');
      console.log('   PAYTM_MID=your_actual_merchant_id');
      console.log('   PAYTM_KEY=your_actual_merchant_key');
      console.log('   PAYTM_WEBSITE=WEBSTAGING');
      console.log('3. Redeploy the service');
    } else {
      console.log('✅ All environment variables are set');
    }

    console.log('\n🎉 Setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Ensure Paytm credentials are properly set in environment variables');
    console.log('2. Test order creation - should now work without 500 errors');
    console.log('3. Test Paytm payment - should now work without 400 errors');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

fixPaytmSetup();