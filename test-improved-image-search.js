const imageService = require('./utils/imageService');
require('dotenv').config();

/**
 * Test the improved image search functionality
 */
async function testImprovedImageSearch() {
  console.log('🧪 Testing Improved Image Search Queries\n');
  console.log('='.repeat(80) + '\n');

  // Test dishes with their expected search queries
  const testDishes = [
    // Biryani varieties
    'Chicken Biryani',
    'Mutton Biryani', 
    'Veg Biryani',
    
    // Chicken dishes
    'Butter Chicken',
    'Chicken Tikka Masala',
    'Chicken 65',
    'Tandoori Chicken',
    
    // Paneer dishes
    'Paneer Butter Masala',
    'Paneer Tikka',
    'Palak Paneer',
    
    // Dal varieties
    'Dal Tadka',
    'Dal Makhani',
    
    // Breads
    'Butter Naan',
    'Garlic Naan',
    'Tandoori Roti',
    
    // South Indian
    'Masala Dosa',
    'Idli',
    'Plain Dosa',
    
    // Beverages
    'Masala Tea',
    'Filter Coffee',
    'Mango Lassi',
    'Mango Juice',
    
    // Desserts
    'Gulab Jamun',
    'Kulfi',
    
    // International
    'Pizza',
    'Burger',
    'Pasta',
    
    // Generic
    'Fried Rice',
    'Mixed Vegetable Curry'
  ];

  console.log('1️⃣ SEARCH QUERY MAPPING TEST');
  console.log('----------------------------\n');

  // Test search query generation
  for (const dish of testDishes) {
    const searchQuery = imageService.testSearchQuery(dish);
    console.log(`${dish.padEnd(25)} → ${searchQuery}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
  console.log('2️⃣ ACTUAL IMAGE FETCHING TEST');
  console.log('-----------------------------\n');

  // Test actual image fetching for a few dishes
  const sampleDishes = [
    'Butter Chicken',
    'Masala Tea', 
    'Paneer Tikka',
    'Chicken Biryani',
    'Filter Coffee'
  ];

  for (const dish of sampleDishes) {
    console.log(`📝 Testing: ${dish}`);
    
    try {
      const startTime = Date.now();
      const imageUrl = await imageService.getFoodImage(dish);
      const endTime = Date.now();
      
      if (imageUrl) {
        console.log(`   ✅ Success (${endTime - startTime}ms): ${imageUrl}`);
      } else {
        console.log(`   ❌ No image found`);
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
  }

  console.log('3️⃣ CACHE PERFORMANCE TEST');
  console.log('-------------------------\n');

  const testDish = 'Butter Chicken';
  
  console.log('First call (no cache):');
  console.time('First call');
  await imageService.getImageForDish(testDish);
  console.timeEnd('First call');
  
  console.log('Second call (cached):');
  console.time('Second call');
  await imageService.getImageForDish(testDish);
  console.timeEnd('Second call');
  
  console.log('\n📊 Cache Stats:', imageService.getCacheStats());
  
  console.log('\n✅ Test Complete!');
}

// Run the test
testImprovedImageSearch().catch(console.error);