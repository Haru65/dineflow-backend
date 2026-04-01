// Load environment variables first
require('dotenv').config();

// Clear the module cache to force fresh load
delete require.cache[require.resolve('./utils/imageService')];

// Now require the imageService
const imageService = require('./utils/imageService');

async function testAuthenticIndianImages() {
  console.log('🇮🇳 Testing Authentic Indian Image Search\n');
  console.log('='.repeat(80) + '\n');

  const indianDishes = [
    'Butter Chicken',
    'Chicken Biryani',
    'Paneer Tikka',
    'Masala Tea',
    'Dal Tadka',
    'Garlic Naan'
  ];

  console.log('1️⃣ ENHANCED SEARCH QUERIES');
  console.log('---------------------------\n');

  for (const dish of indianDishes) {
    const searchQuery = imageService.testSearchQuery(dish);
    console.log(`${dish.padEnd(20)} → ${searchQuery}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
  console.log('2️⃣ AUTHENTIC IMAGE FETCHING TEST');
  console.log('--------------------------------\n');

  for (const dish of indianDishes) {
    console.log(`📝 Testing: ${dish}`);
    console.log(`🔍 Query: ${imageService.testSearchQuery(dish)}`);
    
    try {
      const startTime = Date.now();
      const imageUrl = await imageService.getFoodImage(dish);
      const endTime = Date.now();
      
      if (imageUrl) {
        console.log(`✅ Success (${endTime - startTime}ms)`);
        console.log(`🖼️ URL: ${imageUrl.substring(0, 80)}...`);
        
        // Extract image ID for verification
        const imageId = imageUrl.match(/photo-([a-zA-Z0-9_-]+)/);
        if (imageId) {
          console.log(`🆔 Image ID: ${imageId[1]}`);
        }
      } else {
        console.log('❌ No image found');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  console.log('📊 Final Cache Stats:', imageService.getCacheStats());
  console.log('\n✅ Enhanced authentic Indian image search complete!');
  console.log('\n💡 The new search uses:');
  console.log('   - "authentic" keyword for better quality');
  console.log('   - "restaurant" keyword for professional food photos');
  console.log('   - Enhanced filtering for Indian cuisine');
  console.log('   - Exclusion of non-Indian cuisines');
}

testAuthenticIndianImages().catch(console.error);