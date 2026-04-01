// Load environment variables first
require('dotenv').config();

// Clear the module cache to force fresh load
delete require.cache[require.resolve('./utils/imageService')];

// Now require the imageService
const imageService = require('./utils/imageService');

async function testFoodOnlySearch() {
  console.log('🍽️ TESTING FOOD-ONLY SEARCH (NO INGREDIENTS/PROCESSES)\n');
  console.log('='.repeat(80) + '\n');

  const testDishes = [
    'Masala Tea',      // This was showing grinding images before
    'Butter Chicken',  // Should show prepared curry
    'Chicken Biryani', // Should show prepared rice dish
    'Paneer Tikka',    // Should show grilled paneer pieces
    'Dal Tadka',       // Should show prepared lentil curry
    'Garlic Naan'      // Should show baked bread
  ];

  console.log('1️⃣ FOOD-FOCUSED SEARCH QUERIES');
  console.log('-------------------------------\n');

  for (const dish of testDishes) {
    const searchQuery = imageService.testSearchQuery(dish);
    console.log(`${dish.padEnd(20)} → ${searchQuery}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
  console.log('2️⃣ PREPARED FOOD FILTERING TEST');
  console.log('-------------------------------\n');

  for (const dish of testDishes) {
    console.log(`📝 Testing: ${dish}`);
    console.log(`🔍 Query: ${imageService.testSearchQuery(dish)}`);
    
    try {
      const startTime = Date.now();
      const imageUrl = await imageService.getFoodImage(dish);
      const endTime = Date.now();
      
      if (imageUrl) {
        console.log(`✅ SUCCESS (${endTime - startTime}ms)`);
        console.log(`🖼️ URL: ${imageUrl.substring(0, 80)}...`);
        
        // Extract image ID for verification
        const imageId = imageUrl.match(/photo-([a-zA-Z0-9_-]+)/);
        if (imageId) {
          console.log(`🆔 Image ID: ${imageId[1]}`);
        }
        
        console.log(`🎯 Should show PREPARED ${dish.toLowerCase()}, not ingredients/grinding!`);
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
  console.log('\n🍽️ FOOD-ONLY SEARCH FEATURES:');
  console.log('   ✅ Focus on "served", "dish", "plate", "bowl", "cup", "glass"');
  console.log('   ✅ Exclude "grinding", "powder", "spice", "ingredient", "raw"');
  console.log('   ✅ Exclude "cooking process", "preparation", "making"');
  console.log('   ✅ Exclude "market", "shop", "vendor", "mortar", "pestle"');
  console.log('   ✅ Prioritize prepared food over cooking ingredients');
  
  console.log('\n✅ Expected Results:');
  console.log('   🍵 Masala Tea → Cup/glass of prepared tea (NOT grinding spices)');
  console.log('   🍛 Butter Chicken → Bowl of curry (NOT raw chicken)');
  console.log('   🍚 Chicken Biryani → Plate of rice dish (NOT raw rice)');
  console.log('   🧀 Paneer Tikka → Grilled pieces on plate (NOT raw paneer)');
  console.log('   🍲 Dal Tadka → Bowl of lentil curry (NOT raw lentils)');
  console.log('   🍞 Garlic Naan → Baked bread on plate (NOT flour/dough)');
}

testFoodOnlySearch().catch(console.error);