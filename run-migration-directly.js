/**
 * Direct Migration Script - Run Locally
 * 
 * This connects directly to your Render PostgreSQL database
 * and adds the logo_url column
 */

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://dineflow_db_y03l_user:x0w5ckMZxLKFGJt1CoWXluqBCkU7mhKl@dpg-d6ngtu7afjfc73fkul30-a.oregon-postgres.render.com/dineflow_db_y03l';

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log('🔄 Connecting to database...');
    await client.connect();
    console.log('✅ Connected successfully\n');

    // Check if column exists
    console.log('🔍 Checking if logo_url column exists...');
    const checkResult = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tenants' AND column_name = 'logo_url'
    `);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column logo_url already exists');
      console.log('   No migration needed\n');
      return;
    }

    console.log('📝 Adding logo_url column to tenants table...');
    
    // Add the column
    await client.query('ALTER TABLE tenants ADD COLUMN logo_url TEXT');
    
    console.log('✅ Column added successfully\n');

    // Verify
    const verifyResult = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns 
      WHERE table_name = 'tenants' AND column_name = 'logo_url'
    `);

    if (verifyResult.rows.length > 0) {
      console.log('✅ Verification successful');
      console.log('   Column details:', verifyResult.rows[0]);
      console.log('');
    }

    // Show current tenants
    const tenantsResult = await client.query(`
      SELECT id, name, 
        CASE 
          WHEN logo_url IS NULL THEN 'No logo'
          ELSE 'Has logo'
        END as logo_status
      FROM tenants
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('📊 Current tenants (showing first 5):');
    console.table(tenantsResult.rows);

    console.log('\n✅ Migration completed successfully!');
    console.log('\n🎉 You can now create restaurants with logos!');

  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    
    if (error.message.includes('already exists')) {
      console.log('\n✅ Column already exists - no action needed');
    } else {
      console.error('\nFull error:', error);
    }
  } finally {
    await client.end();
    console.log('\n🔌 Database connection closed');
  }
}

console.log('🚀 Direct Database Migration Script');
console.log('=' .repeat(60));
console.log('Database: Render PostgreSQL (Oregon)');
console.log('Table: tenants');
console.log('Action: Add logo_url column');
console.log('=' .repeat(60));
console.log('');

runMigration()
  .then(() => {
    console.log('\n✅ All done! Test creating a restaurant now.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
