// Simple script to fix the order status constraint in production
// Run this once after deployment to fix the constraint issue

require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixConstraint() {
  const client = await pool.connect();
  
  try {
    console.log('Fixing order status constraint...');
    
    // Drop existing constraint
    await client.query('ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check');
    
    // Add new constraint with draft support
    await client.query(`
      ALTER TABLE orders ADD CONSTRAINT orders_status_check 
      CHECK (status IN ('draft', 'pending', 'confirmed', 'cooking', 'ready', 'served', 'cancelled'))
    `);
    
    console.log('✅ Constraint fixed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

fixConstraint();