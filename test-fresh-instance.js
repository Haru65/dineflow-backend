// Load environment variables first
require('dotenv').config();

// Clear the module cache to force fresh load
delete require.cache[require.resolve('./utils/imageService')];

// Now require the imageService
const imageService = require('./utils/imageService');

console.log('🧪 Testing Fresh ImageService Instance\n');
console.log('=====================================\n');

console.log('Environment variables:');
console.log('UNSPLASH_ACCESS_KEY:', process.env.UNSPLASH_ACCESS_KEY ? `${process.env.UNSPLASH_ACCESS_KEY.substring(0, 10)}...` : 'NOT SET');

console.log('\nImageService properties:');
console.log('unsplashAccessKey:', imageService.unsplashAccessKey ? `${imageService.unsplashAccessKey.substring(0, 10)}...` : 'NOT SET');
console.log('isApiKeyConfigured():', imageService.isApiKeyConfigured());

async function testImageFetch() {
  console.log('\n🔍 Testing image fetch...');
  
  try {
    const imageUrl = await imageService.getFoodImage('Butter Chicken');
    
    if (imageUrl) {
      console.log('✅ Success:', imageUrl);
    } else {
      console.log('❌ No image returned');
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testImageFetch();