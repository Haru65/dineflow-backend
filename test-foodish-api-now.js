const axios = require('axios');

/**
 * Quick test to verify Foodish API is working
 */

async function testFoodishAPI() {
  console.log('🧪 Testing Foodish API...\n');

  const testCategories = [
    'biryani',
    'burger',
    'butter-chicken',
    'dessert',
    'dosa',
    'idly',
    'pasta',
    'pizza',
    'rice',
    'samosa'
  ];

  for (const category of testCategories) {
    try {
      console.log(`📝 Testing category: ${category}`);
      
      const response = await axios.get(`https://foodish-api.com/api/images/${category}`, {
        timeout: 5000
      });
      
      if (response.data && response.data.image) {
        console.log(`   ✅ Success: ${response.data.image}`);
      } else {
        console.log(`   ❌ No image returned`);
      }
      
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      if (error.response) {
        console.log(`   Status: ${error.response.status}`);
        console.log(`   Data:`, error.response.data);
      }
    }
    
    // Small delay
    await new Promise(resolve => setTimeout(resolve, 500));
  }
}

testFoodishAPI().catch(console.error);
