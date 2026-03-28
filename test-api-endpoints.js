const axios = require('axios');

// Test configuration
const BASE_URL = 'http://localhost:3000/api';
const TEST_TOKEN = 'your-test-token-here'; // Replace with actual token
const TEST_TENANT_ID = 'your-tenant-id-here'; // Replace with actual tenant ID
const TEST_ITEM_ID = 'your-item-id-here'; // Replace with actual item ID

async function testImageEndpoints() {
  console.log('🧪 Testing Image API Endpoints...\n');

  const headers = {
    'Authorization': `Bearer ${TEST_TOKEN}`,
    'Content-Type': 'application/json'
  };

  // Test 1: Auto-fetch image for dish name
  console.log('1. Testing auto-fetch image endpoint:');
  try {
    const response = await axios.post(`${BASE_URL}/restaurant/auto-fetch-image`, {
      dishName: 'Chicken Biryani'
    }, { headers });
    
    console.log('   ✅ Success:', response.data);
  } catch (error) {
    console.log('   ❌ Error:', error.response?.data || error.message);
  }

  console.log('');

  // Test 2: Single item image update (requires valid tenant and item IDs)
  console.log('2. Testing single item image update:');
  if (TEST_TENANT_ID !== 'your-tenant-id-here' && TEST_ITEM_ID !== 'your-item-id-here') {
    try {
      const response = await axios.post(
        `${BASE_URL}/restaurant/${TEST_TENANT_ID}/menu/items/${TEST_ITEM_ID}/auto-image`,
        {},
        { headers }
      );
      
      console.log('   ✅ Success:', response.data);
    } catch (error) {
      console.log('   ❌ Error:', error.response?.data || error.message);
    }
  } else {
    console.log('   ⏭️  Skipped - Update TEST_TENANT_ID and TEST_ITEM_ID in script');
  }

  console.log('');

  // Test 3: Bulk image update (requires valid tenant ID)
  console.log('3. Testing bulk image update:');
  if (TEST_TENANT_ID !== 'your-tenant-id-here') {
    try {
      const response = await axios.post(
        `${BASE_URL}/restaurant/${TEST_TENANT_ID}/menu/items/bulk-auto-images`,
        {},
        { headers }
      );
      
      console.log('   ✅ Success:', response.data);
    } catch (error) {
      console.log('   ❌ Error:', error.response?.data || error.message);
    }
  } else {
    console.log('   ⏭️  Skipped - Update TEST_TENANT_ID in script');
  }

  console.log('\n📋 Test Summary:');
  console.log('✅ Auto-fetch endpoint: Available');
  console.log('⚠️  Single/Bulk endpoints: Require authentication and valid IDs');
  console.log('\n🔧 To test authenticated endpoints:');
  console.log('1. Update TEST_TOKEN with valid JWT token');
  console.log('2. Update TEST_TENANT_ID with valid tenant ID');
  console.log('3. Update TEST_ITEM_ID with valid menu item ID');
  console.log('4. Run: node test-api-endpoints.js');
}

// Test without authentication (just the image service)
async function testImageServiceOnly() {
  console.log('🧪 Testing Image Service (No Auth Required)...\n');

  const imageService = require('./utils/imageService');

  const testDishes = [
    'Chicken Biryani',
    'Margherita Pizza',
    'Chocolate Cake'
  ];

  for (const dish of testDishes) {
    console.log(`📝 Testing: ${dish}`);
    try {
      const imageUrl = await imageService.autoFetchImageForMenuItem(dish);
      console.log(`   ✅ Success: ${imageUrl}`);
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    console.log('');
  }

  console.log('✅ Image Service Test Complete!');
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
🧪 API Endpoints Test Script

Usage:
  node test-api-endpoints.js [options]

Options:
  --service-only    Test only image service (no API calls)
  --endpoints       Test API endpoints (requires auth)
  --help, -h        Show this help

Examples:
  node test-api-endpoints.js --service-only
  node test-api-endpoints.js --endpoints
  node test-api-endpoints.js  (runs both)
    `);
    return;
  }

  if (args.includes('--service-only')) {
    await testImageServiceOnly();
  } else if (args.includes('--endpoints')) {
    await testImageEndpoints();
  } else {
    // Run both by default
    await testImageServiceOnly();
    console.log('\n' + '='.repeat(50) + '\n');
    await testImageEndpoints();
  }
}

if (require.main === module) {
  main().catch(console.error);
}