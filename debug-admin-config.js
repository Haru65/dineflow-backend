require('dotenv').config();
const { initializeDatabase } = require('./database-postgres');
const TenantRepository = require('./repositories/TenantRepository');
const PaymentProviderRepository = require('./repositories/PaymentProviderRepository');

async function debugAdminConfig() {
  try {
    console.log('🔍 Debugging Admin Panel Configuration...\n');
    
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database initialized');

    // Find restaurant
    const tenant = await TenantRepository.findBySlug('the-shubham-cafe');
    if (!tenant) {
      console.log('❌ Restaurant not found');
      return;
    }
    
    console.log('✅ Restaurant found:');
    console.log('   - Name:', tenant.name);
    console.log('   - ID:', tenant.id);
    console.log('   - Slug:', tenant.slug);

    // Check what's actually in the payment_providers table
    console.log('\n📋 Checking payment_providers table...');
    
    const { dbAll } = require('./database-postgres');
    
    // Get all payment providers for this tenant
    const allConfigs = await dbAll(
      'SELECT * FROM payment_providers WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenant.id]
    );
    
    if (allConfigs.length === 0) {
      console.log('❌ No payment configurations found in database');
      console.log('💡 This means the admin panel configuration was not saved properly');
      return;
    }
    
    console.log(`✅ Found ${allConfigs.length} payment configuration(s):`);
    
    allConfigs.forEach((config, index) => {
      console.log(`\n   Configuration ${index + 1}:`);
      console.log('   - ID:', config.id);
      console.log('   - Provider:', config.provider);
      console.log('   - Key ID:', config.key_id);
      console.log('   - Key Secret (first 10 chars):', config.key_secret ? config.key_secret.substring(0, 10) + '...' : 'NULL');
      console.log('   - Website:', config.website || 'NULL');
      console.log('   - Active:', config.is_active ? 'Yes' : 'No');
      console.log('   - Created:', config.created_at);
      console.log('   - Updated:', config.updated_at);
    });
    
    // Specifically check Paytm config using the repository method
    console.log('\n📋 Testing PaymentProviderRepository.findByTenant()...');
    
    const paytmConfig = await PaymentProviderRepository.findByTenant(tenant.id, 'paytm');
    
    if (paytmConfig) {
      console.log('✅ Paytm config found via repository:');
      console.log('   - ID:', paytmConfig.id);
      console.log('   - Merchant ID:', paytmConfig.key_id);
      console.log('   - Has Merchant Key:', !!paytmConfig.key_secret);
      console.log('   - Website:', paytmConfig.website || 'Not set');
      console.log('   - Active:', paytmConfig.is_active);
      
      // Test if the credentials look valid
      if (paytmConfig.key_id && paytmConfig.key_secret) {
        console.log('✅ Credentials appear to be properly set');
        
        // Check if they match what you configured
        console.log('\n📋 Credential validation:');
        console.log('   - Merchant ID starts with expected prefix:', paytmConfig.key_id.startsWith('rqM') ? 'Yes' : 'No');
        console.log('   - Merchant Key length:', paytmConfig.key_secret.length, 'characters');
        console.log('   - Website type:', paytmConfig.website || 'WEBSTAGING (default)');
      } else {
        console.log('❌ Credentials are missing or invalid');
      }
    } else {
      console.log('❌ No Paytm config found via repository method');
      console.log('💡 This suggests an issue with the repository query');
    }
    
    // Test the exact query that the Paytm route uses
    console.log('\n📋 Testing exact query used by Paytm route...');
    const directQuery = await dbAll(
      'SELECT * FROM payment_providers WHERE tenant_id = $1 AND provider = $2 AND is_active = 1',
      [tenant.id, 'paytm']
    );
    
    if (directQuery.length > 0) {
      console.log('✅ Direct query found', directQuery.length, 'active Paytm config(s)');
      directQuery.forEach(config => {
        console.log('   - Config ID:', config.id);
        console.log('   - Merchant ID:', config.key_id);
        console.log('   - Active:', config.is_active);
      });
    } else {
      console.log('❌ Direct query found no active Paytm configs');
      console.log('💡 Check if is_active = 1 or if provider = "paytm" exactly');
    }

    console.log('\n🎯 Diagnosis:');
    if (paytmConfig && paytmConfig.key_id && paytmConfig.key_secret) {
      console.log('✅ Configuration exists and should work');
      console.log('💡 If still getting 500 errors, the issue is likely in the Paytm API call');
    } else if (allConfigs.length > 0) {
      console.log('⚠️  Configurations exist but Paytm config has issues');
      console.log('💡 Check provider name, is_active status, or credential validity');
    } else {
      console.log('❌ No configurations found - admin panel save failed');
      console.log('💡 Check the payment configuration API endpoints');
    }

  } catch (error) {
    console.error('❌ Debug failed:', error);
    console.error('Stack trace:', error.stack);
  }
}

debugAdminConfig();