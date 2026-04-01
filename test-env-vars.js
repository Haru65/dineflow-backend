require('dotenv').config();

console.log('🔍 Environment Variables Test\n');
console.log('============================\n');

console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('UNSPLASH_ACCESS_KEY:', process.env.UNSPLASH_ACCESS_KEY ? `${process.env.UNSPLASH_ACCESS_KEY.substring(0, 10)}...` : 'NOT SET');
console.log('UNSPLASH_SECRET_KEY:', process.env.UNSPLASH_SECRET_KEY ? `${process.env.UNSPLASH_SECRET_KEY.substring(0, 10)}...` : 'NOT SET');
console.log('UNSPLASH_APP_NAME:', process.env.UNSPLASH_APP_NAME);

// Test the image service configuration
const imageService = require('./utils/imageService');
console.log('\n📊 Image Service Configuration:');
console.log('isApiKeyConfigured:', imageService.isApiKeyConfigured());
console.log('getConfigStatus:', imageService.getConfigStatus());