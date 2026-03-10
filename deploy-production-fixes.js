#!/usr/bin/env node

/**
 * Production Database Fixes for Render Deployment
 * 
 * This script fixes the following issues:
 * 1. Missing 'website' column in payment_providers table
 * 2. Order status constraint not allowing 'draft' status
 * 3. Ensures proper PostgreSQL parameter syntax
 * 
 * Run this on Render after deployment to fix database issues
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function deployProductionFixes() {
  console.log('🚀 Starting production deployment fixes...');
  console.log('Environment:', process.env.NODE_ENV);
  console.log('Database URL exists:', !!process.env.DATABASE_URL);
  
  const client = await pool.connect();
  
  try {
    // Fix 1: Add website column to payment_providers table
    console.log('\n📋 Fix 1: Payment Providers Table');
    
    const websiteColumnExists = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payment_providers' AND column_name = 'website'
    `);
    
    if (websiteColumnExists.rows.length === 0) {
      console.log('   Adding website column...');
      await client.query(`ALTER TABLE payment_providers ADD COLUMN website TEXT`);
      console.log('   ✅ Website column added');
    } else {
      console.log('   ✅ Website column already exists');
    }
    
    // Fix 2: Update orders table constraints
    console.log('\n📋 Fix 2: Orders Table Constraints');
    
    // Drop existing problematic constraints
    const existingConstraints = await client.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = 'orders'::regclass AND contype = 'c' AND conname LIKE '%status%'
    `);
    
    for (const constraint of existingConstraints.rows) {
      console.log(`   Dropping constraint: ${constraint.conname}`);
      await client.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS ${constraint.conname}`);
    }
    
    // Add new constraints that support draft status
    console.log('   Adding new status constraints...');
    await client.query(`
      ALTER TABLE orders ADD CONSTRAINT orders_status_check 
      CHECK (status IN ('draft', 'pending', 'confirmed', 'cooking', 'ready', 'served', 'cancelled'))
    `);
    
    await client.query(`
      ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
      CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'))
    `);
    console.log('   ✅ Status constraints updated');
    
    // Fix 3: Ensure all required indexes exist
    console.log('\n📋 Fix 3: Database Indexes');
    
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)',
      'CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)',
      'CREATE INDEX IF NOT EXISTS idx_payment_providers_tenant_provider ON payment_providers(tenant_id, provider)',
      'CREATE INDEX IF NOT EXISTS idx_orders_tenant_status ON orders(tenant_id, status)',
      'CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)'
    ];
    
    for (const indexQuery of indexes) {
      await client.query(indexQuery);
    }
    console.log('   ✅ All indexes created');
    
    // Fix 4: Test the fixes
    console.log('\n📋 Fix 4: Testing Database Operations');
    
    // Test payment provider insertion
    const testTenantId = 'test-' + Date.now();
    const testConfigId = 'config-' + Date.now();
    
    await client.query(`
      INSERT INTO payment_providers (id, tenant_id, provider, key_id, key_secret, website, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [testConfigId, testTenantId, 'paytm', 'test_key', 'test_secret', 'WEBSTAGING', 1]);
    console.log('   ✅ Payment provider insertion works');
    
    // Test draft order creation
    const testOrderId = 'order-' + Date.now();
    await client.query(`
      INSERT INTO orders (id, tenant_id, source_type, source_reference, status, payment_status, total_amount)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [testOrderId, testTenantId, 'table', 'test-table', 'draft', 'pending', 100.00]);
    console.log('   ✅ Draft order creation works');
    
    // Test order status update
    await client.query(`
      UPDATE orders SET status = $1, payment_status = $2 WHERE id = $3
    `, ['confirmed', 'completed', testOrderId]);
    console.log('   ✅ Order status update works');
    
    // Cleanup test data
    await client.query('DELETE FROM orders WHERE id = $1', [testOrderId]);
    await client.query('DELETE FROM payment_providers WHERE id = $1', [testConfigId]);
    console.log('   ✅ Test cleanup completed');
    
    // Final verification
    console.log('\n📋 Final Verification');
    
    const finalCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'payment_providers' AND column_name = 'website') as website_column_exists,
        (SELECT COUNT(*) FROM pg_constraint WHERE conrelid = 'orders'::regclass AND contype = 'c' AND consrc LIKE '%draft%') as draft_constraint_exists
    `);
    
    const result = finalCheck.rows[0];
    console.log('   Website column exists:', result.website_column_exists > 0);
    console.log('   Draft status constraint exists:', result.draft_constraint_exists > 0);
    
    if (result.website_column_exists > 0 && result.draft_constraint_exists > 0) {
      console.log('\n🎉 ALL PRODUCTION FIXES COMPLETED SUCCESSFULLY!');
      console.log('\n✅ Your payment system should now work correctly:');
      console.log('   - Admin panel can save Paytm configuration');
      console.log('   - Orders can be created with draft status');
      console.log('   - Payment flow will work end-to-end');
    } else {
      throw new Error('Some fixes did not apply correctly');
    }
    
  } catch (error) {
    console.error('\n❌ Production fixes failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the deployment fixes
if (require.main === module) {
  deployProductionFixes()
    .then(() => {
      console.log('\n✅ Production deployment fixes completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n❌ Production deployment fixes failed:', error);
      process.exit(1);
    });
}

module.exports = { deployProductionFixes };