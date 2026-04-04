const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Production database connection
const DATABASE_URL = 'postgresql://dineflow_db_y03l_user:x0w5ckMZxLKFGJt1CoWXluqBCkU7mhKl@dpg-d6ngtu7afjfc73fkul30-a.oregon-postgres.render.com/dineflow_db_y03l';

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔌 Connecting to production database...');
    await client.connect();
    console.log('✅ Connected successfully!\n');

    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '005_combo_offers.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Running combo offers migration...');
    console.log('─'.repeat(50));
    
    // Execute migration
    await client.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');

    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const verifyQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('combo_offers', 'combo_items')
      ORDER BY table_name;
    `;
    
    const result = await client.query(verifyQuery);
    
    if (result.rows.length === 2) {
      console.log('✅ Tables created successfully:');
      result.rows.forEach(row => {
        console.log(`   - ${row.table_name}`);
      });
    } else {
      console.log('⚠️  Warning: Expected 2 tables, found', result.rows.length);
    }

    // Check indexes
    console.log('\n🔍 Verifying indexes...');
    const indexQuery = `
      SELECT indexname 
      FROM pg_indexes 
      WHERE tablename IN ('combo_offers', 'combo_items')
      ORDER BY indexname;
    `;
    
    const indexes = await client.query(indexQuery);
    console.log(`✅ Created ${indexes.rows.length} indexes:`);
    indexes.rows.forEach(row => {
      console.log(`   - ${row.indexname}`);
    });

    console.log('\n🎉 Combo offers feature is ready to use!');
    console.log('\nNext steps:');
    console.log('1. Deploy backend with combo routes');
    console.log('2. Deploy frontend with combo management UI');
    console.log('3. Test creating a combo offer');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

// Run migration
console.log('🚀 Starting Combo Offers Migration');
console.log('═'.repeat(50));
console.log('Database:', DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
console.log('═'.repeat(50));
console.log('');

runMigration();
