require('dotenv').config();
const axios = require('axios');

/**
 * Complete test of the image update flow
 * Tests both Foodish API and the backend endpoints
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3000';

async function testFoodishAPI() {
  console.log('1️⃣ Testing Foodish API directly...\n');

  const testDishes = [
    { name: 'Chicken Biryani', category: 'biryani' },
    { name: 'Cheese Burger', category: 'burger' },
    { name: 'Margherita Pizza', category: 'pizza' }
  ];

  for (const dish of testDishes) {
    try {
      const response = await axios.get(`https://foodish-api.com/api/images/${dish.category}`, {
        timeout: 5000
      });
      
      if (response.data && response.data.image) {
        console.log(`✅ ${dish.name}: ${response.data.image}`);
      } else {
        console.log(`❌ ${dish.name}: No image returned`);
      }
    } catch (error) {
      console.log(`❌ ${dish.name}: ${error.message}`);
    }
  }
}

async function testImageService() {
  console.log('\n2️⃣ Testing backend image service...\n');

  const imageService = require('./utils/imageService');

  const testDishes = [
    'Chicken Biryani',
    'Cheese Burger',
    'Margherita Pizza',
    'Chocolate Cake',
    'Masala Dosa'
  ];

  for (const dish of testDishes) {
    try {
      const imageUrl = await imageService.autoFetchImageForMenuItem(dish);
      if (imageUrl) {
        console.log(`✅ ${dish}: ${imageUrl}`);
      } else {
        console.log(`❌ ${dish}: No image found`);
      }
    } catch (error) {
      console.log(`❌ ${dish}: ${error.message}`);
    }
  }

  console.log('\n📊 Cache Stats:', imageService.getCacheStats());
}

async function testBackendEndpoint() {
  console.log('\n3️⃣ Testing backend endpoint (requires auth)...\n');

  // This requires a valid JWT token
  const token = process.env.TEST_JWT_TOKEN;

  if (!token) {
    console.log('⚠️  Skipping endpoint test - no TEST_JWT_TOKEN in .env');
    console.log('   To test endpoints, add TEST_JWT_TOKEN to your .env file');
    return;
  }

  try {
    const response = await axios.post(
      `${API_BASE_URL}/admin/restaurant/auto-fetch-image`,
      { dishName: 'Chicken Biryani' },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Endpoint test successful:', response.data);
  } catch (error) {
    if (error.response) {
      console.log(`❌ Endpoint test failed: ${error.response.status} - ${error.response.data.error}`);
    } else {
      console.log(`❌ Endpoint test failed: ${error.message}`);
    }
  }
}

async function testContentTypeValidation() {
  console.log('\n4️⃣ Testing Content-Type validation...\n');

  const testCases = [
    {
      name: 'With Content-Type header and body',
      headers: { 'Content-Type': 'application/json' },
      body: {},
      shouldPass: true
    },
    {
      name: 'Without Content-Type header',
      headers: {},
      body: {},
      shouldPass: false
    },
    {
      name: 'With wrong Content-Type',
      headers: { 'Content-Type': 'text/plain' },
      body: {},
      shouldPass: false
    }
  ];

  for (const testCase of testCases) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/admin/restaurant/auto-fetch-image`,
        testCase.body,
        { headers: testCase.headers }
      );

      if (testCase.shouldPass) {
        console.log(`✅ ${testCase.name}: Passed (but needs auth)`);
      } else {
        console.log(`❌ ${testCase.name}: Should have failed but passed`);
      }
    } catch (error) {
      if (error.response) {
        if (error.response.status === 400 && !testCase.shouldPass) {
          console.log(`✅ ${testCase.name}: Correctly rejected with 400`);
        } else if (error.response.status === 401 && testCase.shouldPass) {
          console.log(`✅ ${testCase.name}: Passed validation (needs auth)`);
        } else {
          console.log(`❌ ${testCase.name}: Unexpected status ${error.response.status}`);
        }
      } else {
        console.log(`❌ ${testCase.name}: ${error.message}`);
      }
    }
  }
}

async function main() {
  console.log('🧪 Complete Image Flow Test\n');
  console.log('='.repeat(50) + '\n');

  try {
    await testFoodishAPI();
    await testImageService();
    await testBackendEndpoint();
    await testContentTypeValidation();

    console.log('\n' + '='.repeat(50));
    console.log('\n✅ All tests completed!\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
