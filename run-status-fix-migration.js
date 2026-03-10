require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function runStatusFixMigration() {
  try {
    console.log('🔧 Running order status constraint fix migration...');
    
    const client = await pool.connect();
    
    // Read the migration file
    const migrationPath = path.join(__dirname, 'migrations', '006_fix_order_status_constraint.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by semicolon and run each statement
    const statements = migrationSQL.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        console.log('Executing:', statement.trim().substring(0, 50) + '...');
        await client.query(statement.trim());
      }
    }
    
    console.log('✅ Migration completed successfully');
    
    client.release();
    await pool.end();
    
    console.log('🎉 Order status constraint fixed!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runStatusFixMigration();