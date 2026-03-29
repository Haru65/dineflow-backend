require('dotenv').config();
const axios = require('axios');
const { initializeDatabase } = require('./database-postgres');
const MenuItemRepository = require('./repositories/MenuItemRepository');
const TenantRepository = require('./repositories/TenantRepository');

/**
 * Test customer menu image display
 * Verifies images are properly returned in the public menu API
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testDatabaseImages() {
  console.log('1️⃣ Testing images in database...\n');

  try {
    await initializeDatabase();

    // Get a sample tenant
    const tenantId = 'ce6f4f55-d97e-476d-847d-d69e8f0be3c8'; // Your tenant ID
    
    const items = await MenuItemRepository.findByTenant(tenantId);
    
    console.log(`Found ${items.length} menu items\n`);
    
    const withImages = items.filter(item => item.image_url);
    const withoutImages = items.filter(item => !item.image_url);
    
    console.log(`✅ Items with images: ${withImages.length}`);
    console.log(`❌ Items without images: ${withoutImages.length}\n`);
    
    if (withImages.length > 0) {
      console.log('Sample items with images:');
      withImages.slice(0, 5).forEach(item => {
        console.log(`  - ${item.name}: ${item.image_url}`);
      });
    }
    
    if (withoutImages.length > 0) {
      console.log('\nItems without images:');
      withoutImages.forEach(item => {
        console.log(`  - ${item.name}`);
      });
    }

    return { withImages: withImages.length, withoutImages: withoutImages.length };
  } catch (error) {
    console.error('❌ Database test failed:', error.message);
    return null;
  }
}

async function testPublicMenuAPI() {
  console.log('\n2️⃣ Testing public menu API...\n');

  try {
    // Test with your restaurant slug and table
    const restaurantSlug = 'the-shubham-cafe'; // Update with your slug
    const tableIdentifier = 'table-1'; // Update with your table identifier
    
    const response = await axios.get(
      `${API_BASE_URL}/api/public/menu/${restaurantSlug}/${tableIdentifier}`
    );

    const data = response.data.data;
    
    console.log(`Restaurant: ${data.restaurant.name}`);
    console.log(`Table: ${data.table.name}`);
    console.log(`Categories: ${data.categories.length}\n`);

    let totalItems = 0;
    let itemsWithImages = 0;
    let itemsWithoutImages = 0;

    data.categories.forEach(category => {
      console.log(`\n📁 ${category.name} (${category.items.length} items)`);
      
      category.items.forEach(item => {
        totalItems++;
        if (item.image_url) {
          itemsWithImages++;
          console.log(`  ✅ ${item.name}: ${item.image_url}`);
        } else {
          itemsWithoutImages++;
          console.log(`  ❌ ${item.name}: No image`);
        }
      });
    });

    console.log(`\n📊 Summary:`);
    console.log(`  Total items: ${totalItems}`);
    console.log(`  With images: ${itemsWithImages}`);
    console.log(`  Without images: ${itemsWithoutImages}`);

    return { totalItems, itemsWithImages, itemsWithoutImages };
  } catch (error) {
    if (error.response) {
      console.error(`❌ API test failed: ${error.response.status} - ${error.response.data.error}`);
    } else {
      console.error(`❌ API test failed: ${error.message}`);
    }
    return null;
  }
}

async function testImageURLs() {
  console.log('\n3️⃣ Testing image URL accessibility...\n');

  try {
    await initializeDatabase();
    
    const tenantId = 'ce6f4f55-d97e-476d-847d-d69e8f0be3c8';
    const items = await MenuItemRepository.findByTenant(tenantId);
    const itemsWithImages = items.filter(item => item.image_url);

    if (itemsWithImages.length === 0) {
      console.log('⚠️  No items with images to test');
      return;
    }

    console.log(`Testing ${Math.min(5, itemsWithImages.length)} image URLs...\n`);

    for (const item of itemsWithImages.slice(0, 5)) {
      try {
        const response = await axios.head(item.image_url, { timeout: 5000 });
        console.log(`✅ ${item.name}: ${response.status} ${response.statusText}`);
      } catch (error) {
        if (error.response) {
          console.log(`❌ ${item.name}: ${error.response.status} ${error.response.statusText}`);
        } else {
          console.log(`❌ ${item.name}: ${error.message}`);
        }
      }
    }
  } catch (error) {
    console.error('❌ URL test failed:', error.message);
  }
}

async function main() {
  console.log('🧪 Customer Menu Images Test\n');
  console.log('='.repeat(60) + '\n');

  const dbResult = await testDatabaseImages();
  const apiResult = await testPublicMenuAPI();
  await testImageURLs();

  console.log('\n' + '='.repeat(60));
  console.log('\n📋 Final Report:\n');

  if (dbResult) {
    console.log('Database:');
    console.log(`  ✅ Items with images: ${dbResult.withImages}`);
    console.log(`  ❌ Items without images: ${dbResult.withoutImages}`);
  }

  if (apiResult) {
    console.log('\nPublic API:');
    console.log(`  ✅ Items with images: ${apiResult.itemsWithImages}`);
    console.log(`  ❌ Items without images: ${apiResult.itemsWithoutImages}`);
  }

  if (dbResult && apiResult) {
    if (dbResult.withImages === apiResult.itemsWithImages) {
      console.log('\n✅ Database and API are in sync!');
    } else {
      console.log('\n⚠️  Mismatch between database and API');
    }
  }

  console.log('\n💡 Next Steps:');
  if (dbResult && dbResult.withoutImages > 0) {
    console.log('  1. Run bulk image update from admin panel');
    console.log('  2. Or run: node dineflow_backend/diagnose-bulk-images.js');
  } else {
    console.log('  1. Check frontend at: https://tablescan-order.vercel.app/order/[slug]/[table]');
    console.log('  2. Verify images are displaying in MenuItemCard components');
  }

  process.exit(0);
}

if (require.main === module) {
  main().catch(console.error);
}
