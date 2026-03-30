const imageService = require('./utils/imageService');
require('dotenv').config();

async function testUnsplashAPI() {
  console.log('🧪 Testing Unsplash API Integration...\n');

  // Check if API key is configured
  if (!process.env.UNSPLASH_ACCESS_KEY || process.env.UNSPLASH_ACCESS_KEY === 'your_unsplash_access_key_here') {
    console.log('❌ UNSPLASH_ACCESS_KEY not configured in .env file');
    console.log('Please set your Unsplash Access Key in .env file');
    return;
  }

  const testDishes = [
    'Chicken Biryani',
    'Margherita Pizza',
    'Chocolate Cake',
    'Butter Chicken',
    'Pasta Carbonara',
    'Beef Burger',
    'Fried Rice',
    'Masala Dosa',
    'Idli Sambar',
    'Vegetable Samosa'
  ];

  console.log('Testing image fetching for different dishes using Unsplash API:\n');

  for (const dish of testDishes) {
    try {
      console.log(`📝 Testing: ${dish}`);
      const imageUrl = await imageService.autoFetchImageForMenuItem(dish);

      if (imageUrl) {
        console.log(`   ✅ Success: ${imageUrl}`);
      } else {
        console.log(`   ❌ No image returned`);
      }

    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }

    console.log(''); // Empty line for readability

    // Longer delay for Unsplash rate limits (50 requests/hour)
    await new Promise(resolve => setTimeout(resolve, 1200));
  }

  console.log('🎉 Unsplash API test completed!');
  console.log('\nThe image service is now using Unsplash API for high-quality food images.');
  console.log('Images will be automatically fetched when you create new menu items.');
}

if (require.main === module) {
  testUnsplashAPI().catch(console.error);
}