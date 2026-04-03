/**
 * Migration: Add is_active column to tenants table
 * This adds support for pausing/resuming tenant access
 */

const { dbRun, dbGet } = require('../database-postgres');

async function addIsActiveColumn() {
  try {
    console.log('🔄 [MIGRATION] Checking if is_active column exists in tenants...');

    // Try to query the column to see if it exists
    try {
      const result = await dbGet(
        `SELECT column_name FROM information_schema.columns 
         WHERE table_name = 'tenants' AND column_name = 'is_active'`
      );
      
      if (result) {
        console.log('✅ [MIGRATION] is_active column already exists - no action needed');
        return;
      }
    } catch (e) {
      // Column doesn't exist, proceed with migration
    }

    console.log('📝 [MIGRATION] Adding is_active column to tenants table...');
    
    // Add the column with default value 1 (active)
    await dbRun(`
      ALTER TABLE tenants 
      ADD COLUMN is_active INTEGER DEFAULT 1
    `);

    console.log('✅ [MIGRATION] Successfully added is_active column');

    // Set all existing tenants to active
    const result = await dbRun(`
      UPDATE tenants SET is_active = 1 WHERE is_active IS NULL
    `);

    console.log('✅ [MIGRATION] All existing tenants set to active (is_active = 1)');

  } catch (error) {
    console.error('❌ [MIGRATION] Error adding is_active column:', error.message);
    throw error;
  }
}

// Run migration
addIsActiveColumn().then(() => {
  console.log('\n✅ [MIGRATION] is_active column migration completed successfully');
  process.exit(0);
}).catch(() => {
  process.exit(1);
});
