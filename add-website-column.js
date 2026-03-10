require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function addWebsiteColumn() {
  try {
    console.log('🔧 Adding website column to payment_providers table...');
    
    const client = await pool.connect();
    
    // Add website column if it doesn't exist
    await client.query(`
      ALTER TABLE payment_providers 
      ADD COLUMN IF NOT EXISTS website TEXT
    `);
    
    console.log('✅ Website column added successfully!');
    
    // Check if the column was added
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payment_providers' 
      AND column_name = 'website'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Website column confirmed in database schema');
    } else {
      console.log('❌ Website column not found after addition');
    }
    
    client.release();
    await pool.end();
    
    console.log('🎉 Migration completed successfully!');
    console.log('💡 You can now save Paytm configuration in the admin panel');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Error details:', error.message);
    process.exit(1);
  }
}

addWebsiteColumn();