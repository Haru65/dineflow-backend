const imageService = require('./utils/imageService');
require('dotenv').config();

/**
 * Test a single image fetch with the improved search
 */
async function testSingleImage() {
  console.log('🧪 Testing Single Image Fetch\n');
  console.log('============================\n');

  const testDish = 'Butter Chicken';
  
  console.log(`📝 Testing dish: ${testDish}`);
  console.log(`🔍 Search query: ${imageService.testSearchQuery(testDish)}`);
  console.log('');

  try {
    console.log('⏳ Fetching image from Unsplash...');
    const startTime = Date.now();
    
    const imageUrl = await imageService.getFoodImage(testDish);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (imageUrl) {
      console.log(`✅ Success! (${duration}ms)`);
      console.log(`🖼️ Image URL: ${imageUrl}`);
      console.log('');
      
      // Test a few more dishes
      const moreDishes = ['Masala Tea', 'Paneer Tikka', 'Chicken Biryani'];
      
      for (const dish of moreDishes) {
        console.log(`📝 Testing: ${dish}`);
        console.log(`🔍 Query: ${imageService.testSearchQuery(dish)}`);
        
        const url = await imageService.getFoodImage(dish);
        if (url) {
          console.log(`✅ Success: ${url.substring(0, 60)}...`);
        } else {
          console.log('❌ Failed');
        }
        console.log('');
      }
      
    } else {
      console.log('❌ No image found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  console.log('📊 Final cache stats:', imageService.getCacheStats());
}

testSingleImage().catch(console.error);