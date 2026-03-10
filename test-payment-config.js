const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function testPaymentConfig() {
  const client = await pool.connect();
  
  try {
    console.log('🧪 Testing payment configuration...');
    
    // Test 1: Check if we can insert payment config with website column
    console.log('1. Testing payment provider insertion...');
    
    const testTenantId = 'test-tenant-' + Date.now();
    const testConfigId = 'test-config-' + Date.now();
    
    // Insert test payment config
    await client.query(`
      INSERT INTO payment_providers (id, tenant_id, provider, key_id, key_secret, website, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [testConfigId, testTenantId, 'paytm', 'test_key', 'test_secret', 'WEBSTAGING', 1]);
    
    console.log('   ✅ Payment config inserted successfully');
    
    // Test 2: Check if we can create draft order
    console.log('2. Testing draft order creation...');
    
    const testOrderId = 'test-order-' + Date.now();
    
    await client.query(`
      INSERT INTO orders (id, tenant_id, source_type, source_reference, status, payment_status, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [testOrderId, testTenantId, 'table', 'test-table', 'draft', 'pending', 100.00]);
    
    console.log('   ✅ Draft order created successfully');
    
    // Test 3: Update order to confirmed
    console.log('3. Testing order status update...');
    
    await client.query(`
      UPDATE orders SET status = $1, payment_status = $2 WHERE id = $3
    `, ['confirmed', 'completed', testOrderId]);
    
    console.log('   ✅ Order status updated successfully');
    
    // Cleanup test data
    console.log('4. Cleaning up test data...');
    await client.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
    await client.query('DELETE FROM payment_providers WHERE id = $1', [testConfigId]);
    console.log('   ✅ Test data cleaned up');
    
    console.log('🎉 All payment configuration tests passed!');
    
  } catch (error) {
    console.error('❌ Payment config test error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the tests
testPaymentConfig()
  .then(() => {
    console.log('✅ Payment configuration tests completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Payment configuration tests failed:', error);
    process.exit(1);
  });