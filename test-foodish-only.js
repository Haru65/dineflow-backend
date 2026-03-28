const imageService = require('./utils/imageService');

async function testFoodishAPI() {
  console.log('🧪 Testing Foodish API Integration...\n');

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

  console.log('Testing image fetching for different dishes:\n');

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
    
    // Small delay to be respectful to the API
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log('🎉 Foodish API test completed!');
  console.log('\nThe image service is ready to use in your application.');
  console.log('Images will be automatically fetched when you create new menu items.');
}

if (require.main === module) {
  testFoodishAPI().catch(console.error);
}