require('dotenv').config();

console.log('🔍 Debug API Key Configuration\n');
console.log('===============================\n');

const key = process.env.UNSPLASH_ACCESS_KEY;
console.log('Raw key:', JSON.stringify(key));
console.log('Key length:', key ? key.length : 'undefined');
console.log('Key starts with:', key ? key.substring(0, 20) : 'undefined');
console.log('Is placeholder?:', key === 'your_unsplash_access_key_here');
console.log('Is PASTE placeholder?:', key === 'PASTE_YOUR_ACCESS_KEY_HERE');
console.log('Trimmed length:', key ? key.trim().length : 'undefined');

// Check the imageService directly
const imageService = require('./utils/imageService');
console.log('\n🔧 ImageService Debug:');
console.log('unsplashAccessKey:', imageService.unsplashAccessKey ? `${imageService.unsplashAccessKey.substring(0, 20)}...` : 'undefined');
console.log('isApiKeyConfigured():', imageService.isApiKeyConfigured());