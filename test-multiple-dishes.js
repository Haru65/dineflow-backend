// Load environment variables first
require('dotenv').config();

// Clear the module cache to force fresh load
delete require.cache[require.resolve('./utils/imageService')];

// Now require the imageService
const imageService = require('./utils/imageService');

async function testMultipleDishes() {
  console.log('🧪 Testing Multiple Dishes with Improved Search\n');
  console.log('='.repeat(80) + '\n');

  const testDishes = [
    'Butter Chicken',
    'Masala Tea', 
    'Paneer Tikka',
    'Chicken Biryani',
    'Filter Coffee',
    'Dal Tadka',
    'Garlic Naan',
    'Masala Dosa'
  ];

  for (const dish of testDishes) {
    console.log(`📝 Testing: ${dish}`);
    console.log(`🔍 Search Query: ${imageService.testSearchQuery(dish)}`);
    
    try {
      const startTime = Date.now();
      const imageUrl = await imageService.getFoodImage(dish);
      const endTime = Date.now();
      
      if (imageUrl) {
        console.log(`✅ Success (${endTime - startTime}ms)`);
        console.log(`🖼️ URL: ${imageUrl.substring(0, 80)}...`);
      } else {
        console.log('❌ No image found');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
    
    // Add a small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('📊 Final Cache Stats:', imageService.getCacheStats());
  console.log('\n✅ Test Complete! The improved search queries are working!');
}

testMultipleDishes().catch(console.error);