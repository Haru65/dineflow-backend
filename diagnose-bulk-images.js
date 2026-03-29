require('dotenv').config();
const { initializeDatabase } = require('./database-postgres');
const MenuItemRepository = require('./repositories/MenuItemRepository');

async function diagnoseBulkImages() {
  console.log('🔍 Diagnosing bulk image update issue...\n');

  try {
    await initializeDatabase();
    console.log('✅ Database connected\n');

    // Test with a specific tenant ID
    const tenantId = 'ce6f4f55-d97e-476d-847d-d69e8f0be3c8';
    
    console.log(`📋 Testing bulk update for tenant: ${tenantId}\n`);
    
    const results = await MenuItemRepository.bulkUpdateMissingImages(tenantId);
    
    console.log('\n📊 Results:');
    console.log(`Total items processed: ${results.length}`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
    
    console.log('\n📝 Details:');
    results.forEach(result => {
      if (result.success) {
        console.log(`✅ ${result.name}: ${result.imageUrl}`);
      } else {
        console.log(`❌ ${result.name}: ${result.error}`);
      }
    });

  } catch (error) {
    console.error('❌ Error:', error);
    console.error('Stack:', error.stack);
  }

  process.exit(0);
}

diagnoseBulkImages();
