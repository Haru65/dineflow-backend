const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixProductionDatabase() {
  const client = await pool.connect();
  
  try {
    console.log('🔧 Starting production database fixes...');
    
    // Fix 1: Add website column to payment_providers table if it doesn't exist
    console.log('1. Checking payment_providers table...');
    
    const websiteColumnCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payment_providers' AND column_name = 'website'
    `);
    
    if (websiteColumnCheck.rows.length === 0) {
      console.log('   Adding website column to payment_providers...');
      await client.query(`ALTER TABLE payment_providers ADD COLUMN website TEXT`);
      console.log('   ✅ Website column added successfully');
    } else {
      console.log('   ✅ Website column already exists');
    }
    
    // Fix 2: Update orders status constraint to allow 'draft'
    console.log('2. Fixing orders status constraint...');
    
    // First, check current constraint
    const currentConstraint = await client.query(`
      SELECT conname, consrc 
      FROM pg_constraint 
      WHERE conrelid = 'orders'::regclass AND contype = 'c' AND conname LIKE '%status%'
    `);
    
    console.log('   Current constraints:', currentConstraint.rows);
    
    // Drop existing status constraint if it exists
    for (const constraint of currentConstraint.rows) {
      if (constraint.conname.includes('status') && !constraint.consrc.includes('draft')) {
        console.log(`   Dropping constraint: ${constraint.conname}`);
        await client.query(`ALTER TABLE orders DROP CONSTRAINT IF EXISTS ${constraint.conname}`);
      }
    }
    
    // Add new constraint that includes 'draft'
    console.log('   Adding new status constraint with draft support...');
    await client.query(`
      ALTER TABLE orders ADD CONSTRAINT orders_status_check 
      CHECK (status IN ('draft', 'pending', 'confirmed', 'cooking', 'ready', 'served', 'cancelled'))
    `);
    console.log('   ✅ Orders status constraint updated successfully');
    
    // Fix 3: Verify payment_status constraint
    console.log('3. Checking payment_status constraint...');
    await client.query(`
      ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_payment_status_check
    `);
    await client.query(`
      ALTER TABLE orders ADD CONSTRAINT orders_payment_status_check 
      CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded'))
    `);
    console.log('   ✅ Payment status constraint verified');
    
    // Fix 4: Ensure proper indexes exist
    console.log('4. Creating missing indexes...');
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_status)`);
    await client.query(`CREATE INDEX IF NOT EXISTS idx_payment_providers_tenant_provider ON payment_providers(tenant_id, provider)`);
    console.log('   ✅ Indexes created successfully');
    
    // Verification
    console.log('5. Verifying fixes...');
    
    // Check payment_providers structure
    const paymentProvidersStructure = await client.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'payment_providers' 
      ORDER BY ordinal_position
    `);
    console.log('   Payment providers columns:', paymentProvidersStructure.rows.map(r => r.column_name));
    
    // Check orders constraints
    const ordersConstraints = await client.query(`
      SELECT conname, consrc 
      FROM pg_constraint 
      WHERE conrelid = 'orders'::regclass AND contype = 'c'
    `);
    console.log('   Orders constraints:', ordersConstraints.rows);
    
    console.log('🎉 All database fixes completed successfully!');
    
  } catch (error) {
    console.error('❌ Database fix error:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the fixes
fixProductionDatabase()
  .then(() => {
    console.log('✅ Production database fixes completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Failed to fix production database:', error);
    process.exit(1);
  });