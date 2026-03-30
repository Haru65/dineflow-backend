const imageService = require('./utils/imageService');
const MenuItemRepository = require('./repositories/MenuItemRepository');
require('dotenv').config();

/**
 * Comprehensive diagnosis of the image integration
 */

async function diagnoseImageIntegration() {
  console.log('🔍 DINEFLOW IMAGE INTEGRATION DIAGNOSIS');
  console.log('=====================================\n');

  // 1. Check Environment Variables
  console.log('1️⃣ ENVIRONMENT VARIABLES');
  console.log('------------------------');

  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!unsplashKey) {
    console.log('❌ UNSPLASH_ACCESS_KEY: Not set');
  } else if (unsplashKey === 'your_unsplash_access_key_here') {
    console.log('❌ UNSPLASH_ACCESS_KEY: Still using placeholder value');
    console.log('   → You need to set a real Unsplash API key');
  } else {
    console.log(`✅ UNSPLASH_ACCESS_KEY: Set (${unsplashKey.substring(0, 10)}...)`);
  }

  console.log(`📝 NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`📝 PORT: ${process.env.PORT || 'not set'}\n`);

  // 2. Test Image Service Configuration
  console.log('2️⃣ IMAGE SERVICE CONFIGURATION');
  console.log('------------------------------');

  if (!unsplashKey || unsplashKey === 'your_unsplash_access_key_here') {
    console.log('⚠️ Cannot test image service - API key not configured');
    console.log('   Please set UNSPLASH_ACCESS_KEY in .env file\n');
    return;
  }

  // 3. Test Single Image Fetch
  console.log('3️⃣ SINGLE IMAGE FETCH TEST');
  console.log('---------------------------');

  try {
    console.log('Testing simple dish: "pizza"');
    const startTime = Date.now();
    const imageUrl = await imageService.getFoodImage('pizza');
    const endTime = Date.now();

    if (imageUrl) {
      console.log(`✅ SUCCESS: ${imageUrl}`);
      console.log(`⏱️ Response time: ${endTime - startTime}ms`);
    } else {
      console.log('❌ FAILED: No image URL returned');
    }
  } catch (error) {
    console.log(`❌ ERROR: ${error.message}`);
    if (error.response) {
      console.log(`   Status: ${error.response.status}`);
      console.log(`   Data:`, JSON.stringify(error.response.data, null, 2));
    }
  }

  console.log('');

  // 4. Test Cache Functionality
  console.log('4️⃣ CACHE FUNCTIONALITY TEST');
  console.log('---------------------------');

  try {
    console.log('First call to getImageForDish("burger")...');
    console.time('First call');
    await imageService.getImageForDish('burger');
    console.timeEnd('First call');

    console.log('Second call to getImageForDish("burger") (should be cached)...');
    console.time('Second call');
    await imageService.getImageForDish('burger');
    console.timeEnd('Second call');

    const stats = imageService.getCacheStats();
    console.log(`📊 Cache stats: ${stats.size} items cached`);
    console.log(`   Cached items: ${stats.keys.join(', ')}`);
  } catch (error) {
    console.log(`❌ Cache test failed: ${error.message}`);
  }

  console.log('');

  // 5. Test Database Integration
  console.log('5️⃣ DATABASE INTEGRATION TEST');
  console.log('----------------------------');

  try {
    // Get items without images
    const query = 'SELECT id, name FROM menu_items WHERE is_available = 1 AND (image_url IS NULL OR image_url = \'\') LIMIT 3';
    const { dbAll } = require('./database-postgres');
    const itemsWithoutImages = await dbAll(query);

    console.log(`Found ${itemsWithoutImages.length} items without images (testing first 3)`);

    if (itemsWithoutImages.length === 0) {
      console.log('✅ All menu items already have images');
    } else {
      for (const item of itemsWithoutImages.slice(0, 2)) {  // Test only 2 to avoid hitting rate limits
        try {
          console.log(`\nTesting: ${item.name}`);
          const imageUrl = await MenuItemRepository.autoUpdateImage(item.id);
          if (imageUrl) {
            console.log(`   ✅ SUCCESS: ${imageUrl}`);
          } else {
            console.log(`   ❌ FAILED: No image URL returned`);
          }
        } catch (error) {
          console.log(`   ❌ ERROR: ${error.message}`);
        }

        // Small delay to respect rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  } catch (error) {
    console.log(`❌ Database test failed: ${error.message}`);
  }

  console.log('');

  // 6. Rate Limiting Analysis
  console.log('6️⃣ RATE LIMITING ANALYSIS');
  console.log('-------------------------');
  console.log('ℹ️ Unsplash API Limits:');
  console.log('   - Free tier: 50 requests/hour');
  console.log('   - This is approximately 1 request every 72 seconds');
  console.log('   - For 19 items: Would take ~23 minutes if done sequentially');
  console.log('   - Consider upgrading to paid tier (5000 requests/hour) for production');

  console.log('');

  // 7. Recommendations
  console.log('7️⃣ RECOMMENDATIONS');
  console.log('------------------');

  if (!unsplashKey || unsplashKey === 'your_unsplash_access_key_here') {
    console.log('🔧 IMMEDIATE ACTIONS REQUIRED:');
    console.log('   1. Get Unsplash API key from https://unsplash.com/developers');
    console.log('   2. Replace UNSPLASH_ACCESS_KEY in .env file');
    console.log('   3. Restart your backend server');
  } else {
    console.log('🔧 OPTIMIZATION SUGGESTIONS:');
    console.log('   1. Consider implementing exponential backoff for failed requests');
    console.log('   2. Add better error handling for different HTTP status codes');
    console.log('   3. Consider caching successful images in database permanently');
    console.log('   4. Implement batch processing with proper rate limiting');
  }

  console.log('\n✅ DIAGNOSIS COMPLETE');
}

if (require.main === module) {
  diagnoseImageIntegration().catch(console.error);
}

module.exports = { diagnoseImageIntegration };