require('dotenv').config();
const { initializeDatabase } = require('./database-postgres');
const TenantRepository = require('./repositories/TenantRepository');
const PaymentProviderRepository = require('./repositories/PaymentProviderRepository');

async function checkCurrentState() {
  try {
    console.log('🔍 Checking Current Database State...\n');
    
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Find restaurant
    const tenant = await TenantRepository.findBySlug('the-shubham-cafe');
    if (!tenant) {
      console.log('❌ Restaurant not found');
      return;
    }
    console.log('✅ Restaurant found:', tenant.name);
    console.log('   - ID:', tenant.id);
    console.log('   - Slug:', tenant.slug);

    // Check all payment providers for this tenant
    console.log('\n📋 Payment Providers in Database:');
    
    try {
      // Check Razorpay
      const razorpayConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'razorpay');
      if (razorpayConfig) {
        console.log('✅ Razorpay Configuration:');
        console.log('   - ID:', razorpayConfig.id);
        console.log('   - Key ID:', razorpayConfig.key_id);
        console.log('   - Key Secret (masked):', razorpayConfig.key_secret.substring(0, 8) + '...');
        console.log('   - Active:', razorpayConfig.is_active ? 'Yes' : 'No');
      } else {
        console.log('⚠️  No Razorpay configuration found');
      }
    } catch (err) {
      console.log('❌ Error checking Razorpay:', err.message);
    }

    try {
      // Check Paytm
      const paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
      if (paytmConfig) {
        console.log('✅ Paytm Configuration:');
        console.log('   - ID:', paytmConfig.id);
        console.log('   - Merchant ID:', paytmConfig.key_id);
        console.log('   - Merchant Key (masked):', paytmConfig.key_secret.substring(0, 8) + '...');
        console.log('   - Website:', paytmConfig.website || 'Not set');
        console.log('   - Active:', paytmConfig.is_active ? 'Yes' : 'No');
        console.log('   - Created:', paytmConfig.created_at);
      } else {
        console.log('⚠️  No Paytm configuration found');
      }
    } catch (err) {
      console.log('❌ Error checking Paytm:', err.message);
    }

    // Check environment variables
    console.log('\n📋 Environment Variables:');
    console.log('   - NODE_ENV:', process.env.NODE_ENV || 'Not set');
    console.log('   - DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
    console.log('   - BASE_URL:', process.env.BASE_URL || 'Not set');
    console.log('   - PAYTM_MID:', process.env.PAYTM_MID || 'Not set');
    console.log('   - PAYTM_KEY:', process.env.PAYTM_KEY ? 'Set (masked: ' + process.env.PAYTM_KEY.substring(0, 8) + '...)' : 'Not set');
    console.log('   - PAYTM_WEBSITE:', process.env.PAYTM_WEBSITE || 'Not set');

    console.log('\n🎯 Summary:');
    console.log('- Restaurant exists: ✅');
    console.log('- Database connection: ✅');
    console.log('- Ready for payment testing');

  } catch (error) {
    console.error('❌ Check failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

checkCurrentState();