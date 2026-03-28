require('dotenv').config();
const imageService = require('./utils/imageService');

/**
 * Test Free Image APIs integration (no GCP required)
 */

async function testFreeImageAPIs() {
  console.log('🧪 Testing Free Image APIs Integration\n');

  // Check configuration
  console.log('📋 Configuration Check:');
  console.log(`Unsplash API Key: ${process.env.UNSPLASH_ACCESS_KEY ? '✅ Configured' : '❌ Not configured (will use fallback)'}`);
  console.log(`Pexels API Key: ${process.env.PEXELS_API_KEY ? '✅ Configured' : '❌ Not configured (will use fallback)'}`);
  console.log(`Foodish API: ✅ Always available (no key needed)`);
  console.log(`Lorem Picsum: ✅ Always available (fallback)`);
  console.log('');

  // Test dishes
  const testDishes = [
    'Chicken Biryani',
    'Margherita Pizza', 
    'Butter Chicken',
    'Chocolate Cake',
    'Masala Dosa',
    'Fish Curry',
    'Paneer Tikka',
    'Gulab Jamun',
    'Caesar Salad',
    'Pasta Carbonara'
  ];

  console.log('🍽️ Testing Image Fetching:\n');

  let successCount = 0;
  let totalTime = 0;

  for (const dish of testDishes) {
    try {
      console.log(`📝 Testing: ${dish}`);
      const startTime = Date.now();
      
      const imageUrl = await imageService.autoFetchImageForMenuItem(dish);
      
      const duration = Date.now() - startTime;
      totalTime += duration;
      
      if (imageUrl) {
        console.log(`  ✅ Success (${duration}ms): ${imageUrl.substring(0, 80)}...`);
        successCount++;
      } else {
        console.log(`  ❌ No image found (${duration}ms)`);
      }
      
      // Small delay between requests to be respectful to APIs
      await new Promise(resolve => setTimeout(resolve, 1000));
      
    } catch (error) {
      console.log(`  ❌ Error: ${error.message}`);
    }
    
    console.log('');
  }

  console.log('🏁 Test completed!');
  console.log(`\n📊 Results Summary:`);
  console.log(`✅ Successful: ${successCount}/${testDishes.length}`);
  console.log(`⏱️ Average time: ${Math.round(totalTime / testDishes.length)}ms per image`);
  console.log(`📈 Success rate: ${Math.round((successCount / testDishes.length) * 100)}%`);
  
  console.log('\n🎯 What this means:');
  if (successCount === testDishes.length) {
    console.log('🎉 Perfect! All dishes got images. Your setup is working great!');
  } else if (successCount > testDishes.length * 0.8) {
    console.log('👍 Excellent! Most dishes got images. Consider adding more API keys for 100% coverage.');
  } else if (successCount > testDishes.length * 0.5) {
    console.log('👌 Good! Many dishes got images. Add Unsplash/Pexels API keys for better results.');
  } else {
    console.log('⚠️ Limited results. Add free API keys from Unsplash or Pexels for much better coverage.');
  }

  console.log('\n🚀 Next steps:');
  console.log('1. Add your menu items in the admin panel');
  console.log('2. Click "Auto-fetch" buttons to get images');
  console.log('3. For better results, get free API keys from:');
  console.log('   - Unsplash: https://unsplash.com/developers (50 requests/hour free)');
  console.log('   - Pexels: https://www.pexels.com/api/ (200 requests/hour free)');
}

// Run the test
if (require.main === module) {
  testFreeImageAPIs()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Test failed:', error);
      process.exit(1);
    });
}

module.exports = testFreeImageAPIs;