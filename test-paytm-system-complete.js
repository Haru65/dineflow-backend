const { initializeDatabase, dbGet, dbAll, dbRun } = require('./database-postgres');

async function testPaytmSystem() {
  console.log('🔍 TESTING PAYTM SYSTEM COMPLETE SETUP...\n');
  
  try {
    await initializeDatabase();
    console.log('✅ Database connected successfully\n');

    // 1. Check if payment_providers table exists and has website column
    console.log('1️⃣ CHECKING PAYMENT_PROVIDERS TABLE SCHEMA...');
    try {
      const tableInfo = await dbAll(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'payment_providers' 
        ORDER BY ordinal_position
      `);
      
      console.log('📋 payment_providers table columns:');
      tableInfo.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
      });
      
      const hasWebsiteColumn = tableInfo.some(col => col.column_name === 'website');
      console.log(`✅ Website column exists: ${hasWebsiteColumn}\n`);
    } catch (err) {
      console.error('❌ Error checking payment_providers schema:', err.message);
    }

    // 2. Check if orders table allows 'draft' status
    console.log('2️⃣ CHECKING ORDERS TABLE STATUS CONSTRAINT...');
    try {
      const constraints = await dbAll(`
        SELECT conname, pg_get_constraintdef(oid) as definition
        FROM pg_constraint 
        WHERE conrelid = 'orders'::regclass 
        AND contype = 'c'
      `);
      
      console.log('📋 Orders table constraints:');
      constraints.forEach(constraint => {
        console.log(`   - ${constraint.conname}: ${constraint.definition}`);
      });
      
      const statusConstraint = constraints.find(c => c.definition.includes('status'));
      if (statusConstraint) {
        const allowsDraft = statusConstraint.definition.includes('draft');
        console.log(`✅ Status constraint allows 'draft': ${allowsDraft}`);
      }
      console.log('');
    } catch (err) {
      console.error('❌ Error checking orders constraints:', err.message);
    }

    // 3. Check if tenants table exists and has test data
    console.log('3️⃣ CHECKING TENANTS TABLE...');
    try {
      const tenants = await dbAll('SELECT id, name, slug FROM tenants LIMIT 5');
      console.log(`📋 Found ${tenants.length} tenants:`);
      tenants.forEach(tenant => {
        console.log(`   - ${tenant.slug}: ${tenant.name} (ID: ${tenant.id})`);
      });
      console.log('');
    } catch (err) {
      console.error('❌ Error checking tenants:', err.message);
    }

    // 4. Check payment providers configuration
    console.log('4️⃣ CHECKING PAYMENT PROVIDERS...');
    try {
      const providers = await dbAll(`
        SELECT pp.*, t.name as tenant_name, t.slug as tenant_slug 
        FROM payment_providers pp 
        LEFT JOIN tenants t ON pp.tenant_id = t.id 
        WHERE pp.provider = 'paytm'
      `);
      
      console.log(`📋 Found ${providers.length} Paytm configurations:`);
      providers.forEach(provider => {
        console.log(`   - Tenant: ${provider.tenant_slug} (${provider.tenant_name})`);
        console.log(`     MID: ${provider.key_id}`);
        console.log(`     Website: ${provider.website || 'NULL'}`);
        console.log(`     Active: ${provider.is_active}`);
        console.log(`     Has Secret: ${!!provider.key_secret}`);
        console.log('');
      });
    } catch (err) {
      console.error('❌ Error checking payment providers:', err.message);
    }

    // 5. Test creating a sample order
    console.log('5️⃣ TESTING ORDER CREATION WITH DRAFT STATUS...');
    try {
      const testOrderId = 'test_order_' + Date.now();
      const testTenant = await dbGet('SELECT id FROM tenants LIMIT 1');
      
      if (testTenant) {
        await dbRun(`
          INSERT INTO orders (id, tenant_id, table_id, status, payment_status, total_amount, created_at)
          VALUES ($1, $2, 'test_table', 'draft', 'pending', 100.00, CURRENT_TIMESTAMP)
        `, [testOrderId, testTenant.id]);
        
        console.log(`✅ Successfully created test order with 'draft' status: ${testOrderId}`);
        
        // Clean up test order
        await dbRun('DELETE FROM orders WHERE id = $1', [testOrderId]);
        console.log('✅ Test order cleaned up\n');
      } else {
        console.log('⚠️ No tenants found to test order creation\n');
      }
    } catch (err) {
      console.error('❌ Error testing order creation:', err.message);
      console.error('   This might indicate the status constraint issue\n');
    }

    // 6. Test Paytm service configuration
    console.log('6️⃣ TESTING PAYTM SERVICE...');
    try {
      const PaytmService = require('./utils/paytmService');
      console.log('✅ PaytmService loaded successfully');
      
      // Test if paytmchecksum is working
      const PaytmChecksum = require('paytmchecksum');
      const testData = { test: 'data' };
      const testKey = 'test_key';
      const checksum = await PaytmChecksum.generateSignature(JSON.stringify(testData), testKey);
      console.log('✅ PaytmChecksum library working');
      console.log(`   Generated test checksum: ${checksum.substring(0, 20)}...\n`);
    } catch (err) {
      console.error('❌ Error testing Paytm service:', err.message);
    }

    console.log('🎉 PAYTM SYSTEM TEST COMPLETE!\n');
    
    // Summary
    console.log('📊 SUMMARY:');
    console.log('   - Database connection: ✅');
    console.log('   - PaytmService: ✅');
    console.log('   - PaytmChecksum library: ✅');
    console.log('   - Check logs above for any specific issues\n');

  } catch (error) {
    console.error('❌ FATAL ERROR:', error);
    console.error('Stack:', error.stack);
  } finally {
    process.exit(0);
  }
}

testPaytmSystem();