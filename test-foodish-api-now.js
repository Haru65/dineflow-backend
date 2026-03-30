const imageService = require('./utils/imageService');
require('dotenv').config();

/**
 * Quick test to verify Unsplash API is working
 */

async function testUnsplashAPI() {
  console.log('🧪 Testing Unsplash API via Image Service...\n');

  // Check if API key is configured
  if (!process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY === 'your_unsplash_access_key_here') {
    console.log('❌ UNSPLASH_ACCESS_KEY not configured in .env file');
    console.log('Please set your Unsplash Access Key in .env file');
    return;
  }

  const testDishes = [
    'biryani',
    'burger',
    'chicken curry',
    'dessert',
    'dosa',
    'idli',
    'pasta',
    'pizza',
    'rice',
    'samosa'
  ];

  for (const dishName of testDishes) {
    try {
      console.log(`📝 Testing dish: ${dishName}`);

      const imageUrl = await imageService.getFoodImage(dishName);

      if (imageUrl) {
        console.log(`   ✅ Success: ${imageUrl}`);
      } else {
        console.log(`   ❌ No image returned`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    // Small delay to respect rate limits
    await new Promise(resolve => setTimeout(resolve, 1200)); // Unsplash has 50 requests/hour limit
  }

  // Test cache functionality
  console.log('\n🔍 Testing cache functionality...');
  const testDish = 'pizza';

  console.time('First request (no cache)');
  await imageService.getImageForDish(testDish);
  console.timeEnd('First request (no cache)');

  console.time('Second request (cached)');
  await imageService.getImageForDish(testDish);
  console.timeEnd('Second request (cached)');

  // Show cache stats
  console.log('\n📊 Cache stats:', imageService.getCacheStats());
}

testUnsplashAPI().catch(console.error);
