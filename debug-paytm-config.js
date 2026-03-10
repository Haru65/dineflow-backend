require('dotenv').config();
const { initializeDatabase } = require('./database-postgres');
const TenantRepository = require('./repositories/TenantRepository');
const PaymentProviderRepository = require('./repositories/PaymentProviderRepository');

async function debugPaytmConfig() {
  try {
    console.log('🔍 Debugging Paytm Configuration...');
    
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Find restaurant
    const tenant = await TenantRepository.findBySlug('the-shubham-cafe');
    if (!tenant) {
      console.log('❌ Restaurant not found');
      return;
    }
    console.log('✅ Restaurant found:', tenant.name, '(ID:', tenant.id + ')');

    // Check Paytm configuration
    const paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    
    if (!paytmConfig) {
      console.log('❌ No Paytm configuration found');
      console.log('💡 Run: npm run setup-paytm');
      return;
    }

    console.log('✅ Paytm configuration found:');
    console.log('   - ID:', paytmConfig.id);
    console.log('   - Provider:', paytmConfig.provider);
    console.log('   - Merchant ID:', paytmConfig.key_id);
    console.log('   - Key (first 8 chars):', paytmConfig.key_secret.substring(0, 8) + '...');
    console.log('   - Active:', paytmConfig.is_active ? 'Yes' : 'No');

    // Check environment variables
    console.log('\n📋 Environment Variables:');
    console.log('   - PAYTM_MID:', process.env.PAYTM_MID || 'NOT SET');
    console.log('   - PAYTM_KEY:', process.env.PAYTM_KEY ? process.env.PAYTM_KEY.substring(0, 8) + '...' : 'NOT SET');
    console.log('   - PAYTM_WEBSITE:', process.env.PAYTM_WEBSITE || 'NOT SET');
    console.log('   - BASE_URL:', process.env.BASE_URL || 'NOT SET');

    // Test configuration validity
    console.log('\n🧪 Configuration Test:');
    
    if (!paytmConfig.key_id || paytmConfig.key_id.includes('PLACEHOLDER')) {
      console.log('❌ Invalid Merchant ID (contains placeholder)');
    } else {
      console.log('✅ Merchant ID looks valid');
    }
    
    if (!paytmConfig.key_secret || paytmConfig.key_secret.includes('PLACEHOLDER')) {
      console.log('❌ Invalid Merchant Key (contains placeholder)');
    } else {
      console.log('✅ Merchant Key looks valid');
    }

    if (paytmConfig.is_active) {
      console.log('✅ Configuration is active');
    } else {
      console.log('❌ Configuration is inactive');
    }

    console.log('\n🎯 Summary:');
    const isValid = paytmConfig && 
                   paytmConfig.key_id && 
                   !paytmConfig.key_id.includes('PLACEHOLDER') &&
                   paytmConfig.key_secret && 
                   !paytmConfig.key_secret.includes('PLACEHOLDER') &&
                   paytmConfig.is_active;

    if (isValid) {
      console.log('✅ Paytm configuration is ready for use');
    } else {
      console.log('❌ Paytm configuration needs to be fixed');
      console.log('💡 Update environment variables with real Paytm credentials');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

debugPaytmConfig();