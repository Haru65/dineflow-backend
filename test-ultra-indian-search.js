// Load environment variables first
require('dotenv').config();

// Clear the module cache to force fresh load
delete require.cache[require.resolve('./utils/imageService')];

// Now require the imageService
const imageService = require('./utils/imageService');

async function testUltraIndianSearch() {
  console.log('🇮🇳 ULTRA-INDIAN IMAGE SEARCH TEST\n');
  console.log('='.repeat(80) + '\n');

  const testDishes = [
    'Butter Chicken',
    'Chicken Biryani',
    'Masala Tea',
    'Paneer Tikka'
  ];

  console.log('1️⃣ ULTRA-INDIAN SEARCH QUERIES');
  console.log('-------------------------------\n');

  for (const dish of testDishes) {
    const searchQuery = imageService.testSearchQuery(dish);
    console.log(`${dish.padEnd(20)} → ${searchQuery}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
  console.log('2️⃣ ULTRA-AGGRESSIVE INDIAN FILTERING TEST');
  console.log('------------------------------------------\n');

  for (const dish of testDishes) {
    console.log(`📝 Testing: ${dish}`);
    console.log(`🔍 Primary Query: ${imageService.testSearchQuery(dish)}`);
    
    try {
      const startTime = Date.now();
      const imageUrl = await imageService.getFoodImage(dish);
      const endTime = Date.now();
      
      if (imageUrl) {
        console.log(`✅ SUCCESS (${endTime - startTime}ms)`);
        console.log(`🖼️ URL: ${imageUrl.substring(0, 80)}...`);
        
        // Extract and display image ID for verification
        const imageId = imageUrl.match(/photo-([a-zA-Z0-9_-]+)/);
        if (imageId) {
          console.log(`🆔 Image ID: ${imageId[1]}`);
        }
        
        // Show which search strategy worked
        console.log(`🎯 This should be ULTRA-INDIAN authentic food!`);
      } else {
        console.log('❌ No image found even with ultra-Indian search');
      }
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log(''); // Empty line for readability
    
    // Add delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('📊 Final Cache Stats:', imageService.getCacheStats());
  console.log('\n🇮🇳 ULTRA-INDIAN SEARCH FEATURES:');
  console.log('   ✅ "traditional indian" prefix for all dishes');
  console.log('   ✅ Regional specificity (hyderabadi, lucknowi, south indian)');
  console.log('   ✅ Cooking method emphasis (tandoor, clay oven, homestyle)');
  console.log('   ✅ Ingredient specificity (basmati rice, cottage cheese, cardamom)');
  console.log('   ✅ Cultural terms (desi, authentic, traditional)');
  console.log('   ✅ Ultra-aggressive filtering against non-Indian cuisines');
  console.log('   ✅ Multiple fallback strategies all forcing Indian context');
  
  console.log('\n✅ If images are STILL not Indian enough, we may need to:');
  console.log('   - Use a different image API (like Indian-specific food databases)');
  console.log('   - Curate a custom image database');
  console.log('   - Use AI image generation with Indian food prompts');
}

testUltraIndianSearch().catch(console.error);