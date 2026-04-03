/**
 * Migration: Fix tenant status - set all tenants to active by default
 * Run this once to fix existing tenants that are paused
 */

const { dbRun, dbAll } = require('../database-postgres');

async function migrateTenantStatus() {
  try {
    console.log('🔄 Starting tenant status migration...');

    // Get all tenants
    const tenants = await dbAll('SELECT id, name, is_active FROM tenants');
    console.log(`📊 Found ${tenants.length} tenants`);

    const pausedCount = tenants.filter(t => !t.is_active).length;
    console.log(`   ${pausedCount} are paused (is_active = 0)`);
    console.log(`   ${tenants.length - pausedCount} are active (is_active = 1)`);

    // Update all paused tenants to active
    if (pausedCount > 0) {
      console.log(`\n✅ Setting all ${pausedCount} paused tenants to active...`);
      await dbRun('UPDATE tenants SET is_active = 1 WHERE is_active = 0 OR is_active IS NULL');
      console.log(`✅ Migration complete!`);
    } else {
      console.log(`✅ No paused tenants found - no action needed`);
    }

  } catch (error) {
    console.error('❌ Migration error:', error);
    process.exit(1);
  }
}

// Run migration
migrateTenantStatus().then(() => {
  console.log('\n✅ Tenant status migration completed successfully');
  process.exit(0);
});
