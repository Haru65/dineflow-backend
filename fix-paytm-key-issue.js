/**
 * FIX PAYTM KEY ISSUE
 * 
 * This script diagnoses and fixes the "Invalid key length" error
 */

const { initializeDatabase, dbGet, dbAll, dbRun } = require('./database-postgres');

async function fixPaytmKeyIssue() {
  console.log('🔧 FIXING PAYTM KEY ISSUE...\n');
  
  try {
    await initializeDatabase();
    console.log('✅ Database connected\n');

    // 1. Check current Paytm configurations
    console.log('1️⃣ CHECKING PAYTM CONFIGURATIONS...');
    const paytmConfigs = await dbAll(`
      SELECT pp.*, t.name as tenant_name, t.slug as tenant_slug 
      FROM payment_providers pp 
      LEFT JOIN tenants t ON pp.tenant_id = t.id 
      WHERE pp.provider = 'paytm'
    `);
    
    console.log(`📋 Found ${paytmConfigs.length} Paytm configurations:`);
    
    for (const config of paytmConfigs) {
      console.log(`\n   🏪 Tenant: ${config.tenant_slug} (${config.tenant_name})`);
      console.log(`      MID: ${config.key_id}`);
      console.log(`      Key Length: ${config.key_secret ? config.key_secret.length : 0} characters`);
      console.log(`      Website: ${config.website || 'NULL'}`);
      console.log(`      Active: ${config.is_active ? 'YES' : 'NO'}`);
      
      // Check if key length is valid
      if (config.key_secret && config.key_secret.length < 16) {
        console.log(`      ⚠️  WARNING: Key too short (${config.key_secret.length} chars)`);
        console.log(`      💡 Paytm merchant keys should be 32+ characters`);
      } else if (config.key_secret && config.key_secret.length >= 16) {
        console.log(`      ✅ Key length looks valid`);
      } else {
        console.log(`      ❌ No merchant key found`);
      }
    }

    // 2. Test Paytm checksum generation
    console.log('\n2️⃣ TESTING PAYTM CHECKSUM GENERATION...');
    
    try {
      const PaytmChecksum = require('paytmchecksum');
      
      // Test with a valid key length
      const testKey32 = 'a'.repeat(32); // 32 character key
      const testKey16 = 'a'.repeat(16); // 16 character key
      const testKey8 = 'a'.repeat(8);   // 8 character key (too short)
      
      const testData = JSON.stringify({ test: 'data' });
      
      console.log('   Testing 32-char key...');
      try {
        const checksum32 = await PaytmChecksum.generateSignature(testData, testKey32);
        console.log('   ✅ 32-char key works');
      } catch (err) {
        console.log('   ❌ 32-char key failed:', err.message);
      }
      
      console.log('   Testing 16-char key...');
      try {
        const checksum16 = await PaytmChecksum.generateSignature(testData, testKey16);
        console.log('   ✅ 16-char key works');
      } catch (err) {
        console.log('   ❌ 16-char key failed:', err.message);
      }
      
      console.log('   Testing 8-char key...');
      try {
        const checksum8 = await PaytmChecksum.generateSignature(testData, testKey8);
        console.log('   ✅ 8-char key works');
      } catch (err) {
        console.log('   ❌ 8-char key failed:', err.message);
      }
      
    } catch (checksumError) {
      console.error('   ❌ PaytmChecksum library error:', checksumError.message);
    }

    // 3. Provide recommendations
    console.log('\n3️⃣ RECOMMENDATIONS...');
    
    const invalidConfigs = paytmConfigs.filter(c => !c.key_secret || c.key_secret.length < 16);
    
    if (invalidConfigs.length > 0) {
      console.log('   ⚠️  ISSUES FOUND:');
      invalidConfigs.forEach(config => {
        console.log(`      - ${config.tenant_slug}: Invalid merchant key`);
      });
      
      console.log('\n   💡 TO FIX:');
      console.log('      1. Login to admin panel');
      console.log('      2. Go to Payment Settings');
      console.log('      3. Update Paytm configuration with correct merchant key');
      console.log('      4. Paytm merchant keys should be 32 characters long');
      console.log('      5. Get the correct key from your Paytm merchant dashboard');
    } else {
      console.log('   ✅ All Paytm configurations look valid');
    }

    // 4. Check if we can auto-fix any issues
    console.log('\n4️⃣ AUTO-FIX CHECK...');
    
    const inactiveConfigs = paytmConfigs.filter(c => !c.is_active);
    if (inactiveConfigs.length > 0) {
      console.log('   Found inactive Paytm configurations. Activating...');
      for (const config of inactiveConfigs) {
        if (config.key_id && config.key_secret && config.key_secret.length >= 16) {
          await dbRun(
            'UPDATE payment_providers SET is_active = 1 WHERE id = $1',
            [config.id]
          );
          console.log(`   ✅ Activated Paytm for ${config.tenant_slug}`);
        }
      }
    }

    console.log('\n🎉 PAYTM KEY DIAGNOSIS COMPLETE!\n');
    
    // Summary
    console.log('📊 SUMMARY:');
    console.log(`   - Total Paytm configs: ${paytmConfigs.length}`);
    console.log(`   - Valid configs: ${paytmConfigs.filter(c => c.key_secret && c.key_secret.length >= 16).length}`);
    console.log(`   - Invalid configs: ${invalidConfigs.length}`);
    console.log(`   - Active configs: ${paytmConfigs.filter(c => c.is_active).length}`);
    
    if (invalidConfigs.length > 0) {
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('   Update Paytm merchant keys in admin panel');
      console.log('   Keys must be obtained from Paytm merchant dashboard');
    }

  } catch (error) {
    console.error('❌ ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

fixPaytmKeyIssue();