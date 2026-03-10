const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixPaytmDatabaseNow() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 FIXING PAYTM DATABASE ISSUES NOW...');
    
    // Fix 1: Add website column if missing
    console.log('1. Adding website column to payment_providers...');
    try {
      await client.query(`ALTER TABLE payment_providers ADD COLUMN IF NOT EXISTS website TEXT`);
      console.log('   ✅ Website column added/verified');
    } catch (error) {
      console.log('   ⚠️ Website column might already exist:', error.message);
    }
    
    // Fix 2: Drop and recreate orders status constraint
    console.log('2. Fixing orders status constraint...');
    try {
      await client.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check`);
      await client.query(`
        ALTER TABLE orders ADD CONSTRAINT orders_status_check 
        CHECK (status IN ('draft', 'pending', 'confirmed', 'cooking', 'ready', 'served', 'cancelled'))
      `);
      console.log('   ✅ Orders status constraint fixed');
    } catch (error) {
      console.log('   ⚠️ Status constraint error:', error.message);
    }
    
    // Fix 3: Ensure payment_status constraint is correct
    console.log('3. Fixing payment_status constraint...');
    try {
      await client.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check`);
      await client.query(`
        ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
        CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'))
      `);
      console.log('   ✅ Payment status constraint fixed');
    } catch (error) {
      console.log('   ⚠️ Payment status constraint error:', error.message);
    }
    
    // Test the fixes
    console.log('4. Testing fixes...');
    
    // Test payment provider insertion with website
    const testId = 'test-' + Date.now();
    await client.query(`
      INSERT INTO payment_providers (id, tenant_id, provider, key_id, key_secret, website, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [testId, 'test-tenant', 'paytm', 'test_key', 'test_secret', 'WEBSTAGING', 1]);
    console.log('   ✅ Payment provider insertion works');
    
    // Test draft order creation
    const testOrderId = 'order-' + Date.now();
    await client.query(`
      INSERT INTO orders (id, tenant_id, source_type, source_reference, status, payment_status, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [testOrderId, 'test-tenant', 'table', 'test-table', 'draft', 'pending', 100.00]);
    console.log('   ✅ Draft order creation works');
    
    // Cleanup
    await client.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
    await client.query('DELETE FROM payment_providers WHERE id = $1', [testId]);
    console.log('   ✅ Test cleanup completed');
    
    console.log('\n🎉 ALL DATABASE FIXES COMPLETED SUCCESSFULLY!');
    console.log('✅ Payment providers can now save with website column');
    console.log('✅ Orders can now be created with draft status');
    console.log('✅ Paytm integration should work now');
    
  } catch (error) {
    console.error('❌ Database fix failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

fixPaytmDatabaseNow()
  .then(() => {
    console.log('\n✅ Database fixes completed - Paytm should work now!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database fixes failed:', error);
    process.exit(1);
  });