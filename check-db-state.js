const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL, 
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function checkDatabase() {
  try {
    // Check payment_providers table structure
    console.log('=== PAYMENT_PROVIDERS TABLE STRUCTURE ===');
    const tableInfo = await pool.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'payment_providers' 
      ORDER BY ordinal_position
    `);
    console.log('Columns:', tableInfo.rows);
    
    // Check orders table constraint
    console.log('\n=== ORDERS TABLE CONSTRAINTS ===');
    const constraints = await pool.query(`
      SELECT conname, consrc 
      FROM pg_constraint 
      WHERE conrelid = 'orders'::regclass AND contype = 'c'
    `);
    console.log('Constraints:', constraints.rows);
    
    // Check if website column exists
    const websiteColumn = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payment_providers' AND column_name = 'website'
    `);
    console.log('\nWebsite column exists:', websiteColumn.rows.length > 0);
    
    await pool.end();
  } catch (error) {
    console.error('Database check error:', error);
    process.exit(1);
  }
}

checkDatabase();