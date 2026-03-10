require('dotenv').config();
const { initializeDatabase } = require('./database-postgres');
const TenantRepository = require('./repositories/TenantRepository');
const PaymentProviderRepository = require('./repositories/PaymentProviderRepository');

async function setupPaytmConfig() {
  try {
    console.log('🔧 Setting up Paytm configuration...');
    
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Find the restaurant
    const tenant = await TenantRepository.findBySlug('the-shubham-cafe');
    if (!tenant) {
      console.log('❌ Restaurant not found');
      return;
    }
    console.log('✅ Restaurant found:', tenant.name);

    // Check if Paytm config already exists
    const existingConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    if (existingConfig) {
      console.log('✅ Paytm configuration already exists');
      return;
    }

    // Create Paytm configuration with staging credentials
    const paytmConfig = {
      tenant_id: tenant.id,
      provider: 'paytm',
      key_id: process.env.PAYTM_MID || 'PAYTM_STAGING_MID',
      key_secret: process.env.PAYTM_KEY || 'PAYTM_STAGING_KEY',
      webhook_secret: null,
      is_active: 1
    };

    const configId = await PaymentProviderRepository.create(paytmConfig);
    console.log('✅ Paytm configuration created:', configId);

    console.log('\n📋 Configuration Details:');
    console.log('- Provider: paytm');
    console.log('- Merchant ID:', paytmConfig.key_id);
    console.log('- Key (masked):', paytmConfig.key_secret.substring(0, 8) + '...');
    console.log('- Status: Active');

    console.log('\n⚠️  IMPORTANT:');
    console.log('1. Update environment variables with real Paytm credentials:');
    console.log('   - PAYTM_MID=your_merchant_id');
    console.log('   - PAYTM_KEY=your_merchant_key');
    console.log('   - PAYTM_WEBSITE=WEBSTAGING (for staging)');
    console.log('2. Restart the application after updating credentials');

    console.log('\n🎉 Paytm configuration setup completed!');

  } catch (error) {
    console.error('❌ Setup failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

setupPaytmConfig();