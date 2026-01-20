const database = require('./database');
const TenantRepository = require('./repositories/TenantRepository');
const MenuCategoryRepository = require('./repositories/MenuCategoryRepository');
const { createDefaultCategories } = require('./utils/defaultCategories');

async function addDefaultCatgorisToExistingRestaurants() {
  try {
    console.log('Starting to add default categories to existing restaurants...');
    
    // Get all tenants
    const db = database.getDatabase();
    const tenants = db.prepare('SELECT id FROM tenants').all();
    
    console.log(`Found ${tenants.length} existing tenant(s)`);
    
    for (const tenant of tenants) {
      // Check if categories already exist
      const existingCategories = db.prepare(
        'SELECT COUNT(*) as count FROM menu_categories WHERE tenant_id = ?'
      ).get(tenant.id);
      
      if (existingCategories.count === 0) {
        console.log(`\nAdding default categories to tenant: ${tenant.id}`);
        await createDefaultCategories(tenant.id);
      } else {
        console.log(`Tenant ${tenant.id} already has ${existingCategories.count} categories, skipping...`);
      }
    }
    
    console.log('\n✅ Successfully added default categories to all restaurants!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error adding default categories:', error);
    process.exit(1);
  }
}

addDefaultCatgorisToExistingRestaurants();
