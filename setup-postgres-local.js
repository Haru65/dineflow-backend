require('dotenv').config();
const { Pool } = require('pg');

/**
 * Setup local PostgreSQL database for DineFlow
 */

async function setupPostgreSQLLocal() {
  console.log('🐘 Setting up local PostgreSQL database for DineFlow...\n');

  // First, try to connect to postgres database to create our database
  const adminUrl = process.env.DATABASE_URL?.replace('/dineflow', '/postgres') || 'postgresql://postgres:password@localhost:5432/postgres';
  
  console.log('📋 Configuration:');
  console.log(`Admin URL: ${adminUrl}`);
  console.log(`Target Database: dineflow`);
  console.log('');

  try {
    console.log('🔍 Testing connection to PostgreSQL server...');
    
    const adminPool = new Pool({
      connectionString: adminUrl,
      ssl: false
    });

    const adminClient = await adminPool.connect();
    console.log('✅ Connected to PostgreSQL server');

    // Check if database exists
    const dbCheckResult = await adminClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'dineflow'"
    );

    if (dbCheckResult.rows.length === 0) {
      console.log('📦 Creating dineflow database...');
      await adminClient.query('CREATE DATABASE dineflow');
      console.log('✅ Database "dineflow" created');
    } else {
      console.log('✅ Database "dineflow" already exists');
    }

    // Check if user exists (optional - can use postgres user)
    try {
      const userCheckResult = await adminClient.query(
        "SELECT 1 FROM pg_roles WHERE rolname = 'dineflow_user'"
      );

      if (userCheckResult.rows.length === 0) {
        console.log('👤 Creating dineflow_user...');
        await adminClient.query("CREATE USER dineflow_user WITH PASSWORD 'dineflow_password'");
        await adminClient.query('GRANT ALL PRIVILEGES ON DATABASE dineflow TO dineflow_user');
        console.log('✅ User "dineflow_user" created with privileges');
      } else {
        console.log('✅ User "dineflow_user" already exists');
      }
    } catch (userError) {
      console.log('⚠️ Could not create user (using postgres user is fine)');
    }

    adminClient.release();
    await adminPool.end();

    // Now test connection to our target database
    console.log('\n🔍 Testing connection to dineflow database...');
    
    const targetPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: false
    });

    const targetClient = await targetPool.connect();
    console.log('✅ Connected to dineflow database');

    // Test a simple query
    const result = await targetClient.query('SELECT NOW() as current_time');
    console.log(`⏰ Current time: ${result.rows[0].current_time}`);

    targetClient.release();
    await targetPool.end();

    console.log('\n🎉 PostgreSQL setup completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Run migrations: npm run migrate-postgres');
    console.log('2. Start server: npm start');
    console.log('3. Test menu images: npm run test-free-images');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    
    if (error.code === 'ECONNREFUSED') {
      console.log('\n💡 PostgreSQL is not running. Please:');
      console.log('1. Install PostgreSQL from https://www.postgresql.org/download/');
      console.log('2. Start PostgreSQL service');
      console.log('3. Update DATABASE_URL in .env with correct credentials');
    } else if (error.code === 'ENOTFOUND') {
      console.log('\n💡 Cannot find PostgreSQL server. Please:');
      console.log('1. Install PostgreSQL locally');
      console.log('2. Update DATABASE_URL in .env file');
    } else if (error.message.includes('authentication')) {
      console.log('\n💡 Authentication failed. Please:');
      console.log('1. Check username/password in DATABASE_URL');
      console.log('2. Update .env with correct PostgreSQL credentials');
    }
    
    console.log('\n📖 See setup-local-database.md for detailed instructions');
  }
}

if (require.main === module) {
  setupPostgreSQLLocal()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Setup failed:', error);
      process.exit(1);
    });
}

module.exports = setupPostgreSQLLocal;