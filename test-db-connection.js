require('dotenv').config();
const { Pool } = require('pg');

async function testConnection() {
  console.log('Testing PostgreSQL connection...');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Set' : 'Not set');
  
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    return;
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Attempting to connect...');
    const client = await pool.connect();
    console.log('✅ Connected to PostgreSQL successfully');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time');
    console.log('✅ Query test successful:', result.rows[0]);
    
    // Check if tenants table exists
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'tenants'
    `);
    
    if (tableCheck.rows.length > 0) {
      console.log('✅ Tenants table exists');
      
      // Count existing tenants
      const tenantCount = await client.query('SELECT COUNT(*) as count FROM tenants');
      console.log(`📊 Existing tenants: ${tenantCount.rows[0].count}`);
    } else {
      console.log('⚠️  Tenants table does not exist - migrations may not have run');
    }
    
    client.release();
    await pool.end();
    console.log('✅ Connection test completed successfully');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();