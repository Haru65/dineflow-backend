require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixOrderStatusConstraint() {
  try {
    console.log('🔧 Fixing order status constraint...');
    
    const client = await pool.connect();
    
    // Drop the existing constraint
    await client.query(`
      ALTER TABLE orders 
      DROP CONSTRAINT IF EXISTS orders_status_check
    `);
    console.log('✅ Dropped existing status constraint');
    
    // Add new constraint with 'draft' included
    await client.query(`
      ALTER TABLE orders 
      ADD CONSTRAINT orders_status_check 
      CHECK (status IN ('draft', 'pending', 'confirmed', 'cooking', 'ready', 'served', 'cancelled'))
    `);
    console.log('✅ Added new status constraint with draft support');
    
    client.release();
    await pool.end();
    
    console.log('🎉 Order status constraint fixed successfully!');
  } catch (error) {
    console.error('❌ Error fixing constraint:', error);
    process.exit(1);
  }
}

fixOrderStatusConstraint();