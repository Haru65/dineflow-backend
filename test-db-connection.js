require('dotenv').config();
const { Pool } = require('pg');

async function testDatabaseConnection() {
  console.log('🔍 Testing PostgreSQL Database Connection...\n');
  
  const databaseUrl = process.env.DATABASE_URL;
  console.log(`Database URL: ${databaseUrl}\n`);
  
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL not found in environment variables');
    console.log('Please check your .env file');
    return;
  }

  if (!databaseUrl.startsWith('postgresql://') && !databaseUrl.startsWith('postgres://')) {
    console.error('❌ Invalid PostgreSQL URL format');
    console.log('Expected format: postgresql://user:password@host:port/database');
    return;
  }

  console.log('📊 Testing PostgreSQL connection...');
  
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    const client = await pool.connect();
    console.log('✅ PostgreSQL connection successful!');
    
    // Test a simple query
    const result = await client.query('SELECT NOW() as current_time, version() as pg_version');
    console.log(`⏰ Current time: ${result.rows[0].current_time}`);
    console.log(`🗄️ PostgreSQL version: ${result.rows[0].pg_version.split(' ')[0]} ${result.rows[0].pg_version.split(' ')[1]}`);
    
    // Check if our tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    if (tablesResult.rows.length > 0) {
      console.log(`\n📋 Existing tables (${tablesResult.rows.length}):`);
      tablesResult.rows.forEach(row => {
        console.log(`  - ${row.table_name}`);
      });
    } else {
      console.log('\n📋 No tables found - you need to run migrations');
      console.log('Run: npm run migrate-postgres');
    }
    
    client.release();
    await pool.end();
    
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:');
    console.error(`   Error: ${error.message}`);
    
    if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Suggestions:');
      console.log('   1. Check if the database hostname is correct');
      console.log('   2. Verify your internet connection (for cloud databases)');
      console.log('   3. The database server might be down');
      console.log('   4. Set up a local PostgreSQL database (see setup-local-database.md)');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 Suggestions:');
      console.log('   1. Check if PostgreSQL is running on the specified port');
      console.log('   2. Verify the port number in your DATABASE_URL');
      console.log('   3. Check firewall settings');
      console.log('   4. Start PostgreSQL service: services.msc → postgresql-x64-13');
    } else if (error.message.includes('authentication')) {
      console.log('\n💡 Suggestions:');
      console.log('   1. Check your username and password in DATABASE_URL');
      console.log('   2. Verify the database user has proper permissions');
      console.log('   3. Try connecting with psql: psql -U username -h host -d database');
    } else if (error.message.includes('database') && error.message.includes('does not exist')) {
      console.log('\n💡 Suggestions:');
      console.log('   1. Create the database first:');
      console.log('      psql -U postgres -c "CREATE DATABASE dineflow;"');
      console.log('   2. Or update DATABASE_URL to use existing database');
    }
  }
}

if (require.main === module) {
  testDatabaseConnection()
    .then(() => {
      console.log('\n🏁 Database connection test completed');
      process.exit(0);
    })
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = testDatabaseConnection;