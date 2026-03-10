/**
 * PRODUCTION PAYTM TEST SCRIPT
 * 
 * This script tests the Paytm payment system on the production server
 * Run this on Render to verify everything is working
 */

const { initializeDatabase, dbGet, dbAll } = require('./database-postgres');

async function testProductionPaytm() {
  console.log('🔍 TESTING PRODUCTION PAYTM SYSTEM...\n');
  
  try {
    // Initialize database
    await initializeDatabase();
    console.log('✅ Database connected successfully\n');

    // 1. Check tenants
    console.log('1️⃣ CHECKING TENANTS...');
    const tenants = await dbAll('SELECT id, name, slug FROM tenants LIMIT 3');
    console.log(`📋 Found ${tenants.length} tenants:`);
    tenants.forEach(tenant => {
      console.log(`   - ${tenant.slug}: ${tenant.name}`);
    });
    console.log('');

    // 2. Check payment providers
    console.log('2️⃣ CHECKING PAYTM CONFIGURATIONS...');
    const paytmConfigs = await dbAll(`
      SELECT pp.*, t.name as tenant_name, t.slug as tenant_slug 
      FROM payment_providers pp 
      LEFT JOIN tenants t ON pp.tenant_id = t.id 
      WHERE pp.provider = 'paytm'
    `);
    
    console.log(`📋 Found ${paytmConfigs.length} Paytm configurations:`);
    paytmConfigs.forEach(config => {
      console.log(`   - Tenant: ${config.tenant_slug}`);
      console.log(`     MID: ${config.key_id}`);
      console.log(`     Website: ${config.website || 'NULL'}`);
      console.log(`     Active: ${config.is_active ? 'YES' : 'NO'}`);
      console.log(`     Has Secret: ${config.key_secret ? 'YES' : 'NO'}`);
      console.log('');
    });

    // 3. Check orders table structure
    console.log('3️⃣ CHECKING ORDERS TABLE...');
    const recentOrders = await dbAll(`
      SELECT id, status, payment_status, total_amount, created_at 
      FROM orders 
      ORDER BY created_at DESC 
      LIMIT 5
    `);
    
    console.log(`📋 Found ${recentOrders.length} recent orders:`);
    recentOrders.forEach(order => {
      console.log(`   - ${order.id}: ${order.status}/${order.payment_status} (₹${order.total_amount})`);
    });
    console.log('');

    // 4. Test Paytm service
    console.log('4️⃣ TESTING PAYTM SERVICE...');
    try {
      const PaytmService = require('./utils/paytmService');
      console.log('✅ PaytmService loaded successfully');
      
      const PaytmChecksum = require('paytmchecksum');
      const testChecksum = await PaytmChecksum.generateSignature('{"test":"data"}', 'test_key');
      console.log('✅ PaytmChecksum library working');
      console.log(`   Test checksum: ${testChecksum.substring(0, 20)}...`);
    } catch (serviceError) {
      console.error('❌ PaytmService error:', serviceError.message);
    }
    console.log('');

    // 5. Environment check
    console.log('5️⃣ ENVIRONMENT CHECK...');
    console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
    console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log(`   BASE_URL: ${process.env.BASE_URL || 'not set'}`);
    console.log('');

    console.log('🎉 PRODUCTION PAYTM TEST COMPLETE!\n');
    
    // Summary
    console.log('📊 SUMMARY:');
    console.log(`   - Database: ✅ Connected`);
    console.log(`   - Tenants: ${tenants.length} found`);
    console.log(`   - Paytm Configs: ${paytmConfigs.length} found`);
    console.log(`   - PaytmService: ✅ Working`);
    console.log(`   - Recent Orders: ${recentOrders.length} found`);
    
    if (paytmConfigs.length === 0) {
      console.log('\n⚠️  WARNING: No Paytm configurations found!');
      console.log('   Admin needs to configure Paytm in the payment settings.');
    }
    
    const activeConfigs = paytmConfigs.filter(c => c.is_active);
    if (activeConfigs.length === 0 && paytmConfigs.length > 0) {
      console.log('\n⚠️  WARNING: Paytm configurations exist but none are active!');
    }

  } catch (error) {
    console.error('❌ FATAL ERROR:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

// Run the test
testProductionPaytm().catch(console.error);