const { dbRun } = require('../database-postgres');

async function addTenantLogoColumn() {
  try {
    console.log('🔄 Adding logo_url column to tenants table...');
    
    await dbRun(`
      ALTER TABLE tenants 
      ADD COLUMN IF NOT EXISTS logo_url TEXT
    `);
    
    console.log('✅ Successfully added logo_url column to tenants table');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding logo_url column:', error);
    process.exit(1);
  }
}

addTenantLogoColumn();
