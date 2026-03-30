require('dotenv').config();
const imageService = require('./utils/imageService');

/**
 * Debug why image updates are failing
 * Tests the image service with actual menu item names
 */

async function testImageService() {
  console.log('🔍 Debugging Image Update Failures\n');
  console.log('='.repeat(60) + '\n');

  const testItems = [
    'Veg Kolapuri',
    'Paneer Tikka Masala',
    'Dal Tadka',
    'Palak Paneer',
    'Paneer Butter Masala',
    'Veg Dum Biryani',
    'Dal Khichdi',
    'Butter Naan',
    'Garlic Naan',
    'Butter Chicken',
    'Chicken Tikka Masala',
    'Murg Handi',
    'Mutton Rogan Josh',
    'Mutton Biryani',
    'Masala Tea',
    'Filter Coffee',
    'Water Melon Juice',
    'Mango Juice',
    'test item'
  ];

  let successful = 0;
  let failed = 0;
  const failures = [];

  console.log('Testing image fetching for all menu items...\n');

  for (const itemName of testItems) {
    try {
      console.log(`📝 Testing: ${itemName}`);
      
      const imageUrl = await imageService.autoFetchImageForMenuItem(itemName);
      
      if (imageUrl) {
        successful++;
        console.log(`   ✅ Success: ${imageUrl}\n`);
      } else {
        failed++;
        failures.push({ item: itemName, error: 'No image returned' });
        console.log(`   ❌ Failed: No image returned\n`);
      }
    } catch (error) {
      failed++;
      failures.push({ item: itemName, error: error.message });
      console.log(`   ❌ Error: ${error.message}`);
      console.log(`   Stack: ${error.stack}\n`);
    }

    // Small delay
    await new Promise(resolve => setTimeout(resolve, 600));
  }

  console.log('='.repeat(60));
  console.log('\n📊 Results:\n');
  console.log(`  Total items: ${testItems.length}`);
  console.log(`  ✅ Successful: ${successful}`);
  console.log(`  ❌ Failed: ${failed}`);

  if (failures.length > 0) {
    console.log('\n❌ Failures:\n');
    failures.forEach(f => {
      console.log(`  - ${f.item}: ${f.error}`);
    });
  }

  console.log('\n📋 Cache Stats:', imageService.getCacheStats());

  if (failed === testItems.length) {
    console.log('\n⚠️  ALL ITEMS FAILED!\n');
    console.log('Possible causes:');
    console.log('  1. Foodish API is down or unreachable');
    console.log('  2. Network connectivity issues');
    console.log('  3. Timeout issues (5 second timeout)');
    console.log('  4. CORS or SSL certificate issues');
    console.log('\nTesting Foodish API directly...\n');
    
    const axios = require('axios');
    try {
      const response = await axios.get('https://foodish-api.com/api/images/biryani', {
        timeout: 5000
      });
      console.log('✅ Foodish API is accessible');
      console.log('   Response:', response.data);
    } catch (error) {
      console.log('❌ Foodish API test failed:', error.message);
      if (error.code) console.log('   Error code:', error.code);
      if (error.response) {
        console.log('   Status:', error.response.status);
        console.log('   Data:', error.response.data);
      }
    }
  }
}

testImageService().catch(console.error);
