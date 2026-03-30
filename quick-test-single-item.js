const imageService = require('./utils/imageService');
const MenuItemRepository = require('./repositories/MenuItemRepository');
require('dotenv').config();

/**
 * Quick test to diagnose why bulk update is failing
 */

async function testSingleItem() {
  console.log('🔍 QUICK DIAGNOSIS - Single Item Test');
  console.log('=====================================\n');

  // Step 1: Check environment
  console.log('1️⃣ CHECKING ENVIRONMENT');
  console.log('------------------------');
  const apiKey = process.env.UNSPLASH_ACCESS_KEY;

  if (!apiKey) {
    console.log('❌ UNSPLASH_ACCESS_KEY: Not set at all');
  } else if (apiKey === 'your_unsplash_access_key_here') {
    console.log('❌ UNSPLASH_ACCESS_KEY: Still using placeholder');
    console.log('   Value:', apiKey);
  } else {
    console.log('✅ UNSPLASH_ACCESS_KEY: Configured');
    console.log('   First 10 chars:', apiKey.substring(0, 10) + '...');
  }
  console.log('');

  // Step 2: Test image service directly
  console.log('2️⃣ TESTING IMAGE SERVICE');
  console.log('------------------------');
  try {
    console.log('Attempting to fetch image for "pizza"...\n');

    const imageUrl = await imageService.autoFetchImageForMenuItem('pizza');

    if (imageUrl) {
      console.log('✅ Image Service SUCCESS');
      console.log('   URL:', imageUrl);
      console.log('   Type:', imageUrl.includes('unsplash') ? 'Unsplash' : 'Fallback');
    } else {
      console.log('❌ Image Service FAILED');
      console.log('   Returned: null');
    }
  } catch (error) {
    console.log('❌ Image Service ERROR');
    console.log('   Error:', error.message);
    console.log('   Stack:', error.stack);
  }
  console.log('');

  // Step 3: Test with actual menu item
  console.log('3️⃣ TESTING WITH DATABASE ITEM');
  console.log('------------------------------');
  try {
    const { dbAll } = require('./database-postgres');

    // Get one item without image
    const items = await dbAll(
      'SELECT id, name FROM menu_items WHERE is_available = 1 AND (image_url IS NULL OR image_url = \'\') LIMIT 1'
    );

    if (items.length === 0) {
      console.log('⚠️ No items without images found in database');
      console.log('   All items already have images!');
    } else {
      const item = items[0];
      console.log(`Found item: ${item.name} (ID: ${item.id})`);
      console.log('Attempting to update image...\n');

      try {
        const imageUrl = await MenuItemRepository.autoUpdateImage(item.id);

        if (imageUrl) {
          console.log('✅ DATABASE UPDATE SUCCESS');
          console.log('   Item:', item.name);
          console.log('   URL:', imageUrl);
        } else {
          console.log('❌ DATABASE UPDATE FAILED');
          console.log('   Item:', item.name);
          console.log('   Returned: null');
        }
      } catch (updateError) {
        console.log('❌ DATABASE UPDATE ERROR');
        console.log('   Error:', updateError.message);
        console.log('   Stack:', updateError.stack);
      }
    }
  } catch (dbError) {
    console.log('❌ DATABASE ERROR');
    console.log('   Error:', dbError.message);
  }
  console.log('');

  // Step 4: Summary
  console.log('4️⃣ DIAGNOSIS SUMMARY');
  console.log('--------------------');

  if (!apiKey || apiKey === 'your_unsplash_access_key_here') {
    console.log('🔧 ACTION REQUIRED:');
    console.log('   1. Get Unsplash API key from https://unsplash.com/developers');
    console.log('   2. Update UNSPLASH_ACCESS_KEY in .env file');
    console.log('   3. Restart backend server');
    console.log('   4. Run this test again');
  } else {
    console.log('✅ API key is configured');
    console.log('   If bulk update still fails, check:');
    console.log('   - Database connection');
    console.log('   - Network access to Unsplash API');
    console.log('   - Rate limits (50 requests/hour)');
  }
}

if (require.main === module) {
  testSingleItem()
    .then(() => process.exit(0))
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { testSingleItem };
