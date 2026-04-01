// Load environment variables first
require('dotenv').config();

// Clear the module cache to force fresh load
delete require.cache[require.resolve('./utils/imageService')];

const axios = require('axios');

/**
 * Test very specific Indian food searches to find the best images
 */
async function testSpecificIndianImages() {
  console.log('🇮🇳 TESTING SPECIFIC INDIAN FOOD SEARCHES\n');
  console.log('='.repeat(80) + '\n');

  const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
  
  if (!unsplashAccessKey || unsplashAccessKey === 'PASTE_YOUR_ACCESS_KEY_HERE') {
    console.error('❌ Unsplash API key not configured');
    return;
  }

  const headers = {
    'Authorization': `Client-ID ${unsplashAccessKey}`,
    'Accept-Version': 'v1',
    'User-Agent': 'DineFlow'
  };

  // Ultra-specific searches for different dishes
  const specificSearches = [
    {
      dish: 'Butter Chicken',
      searches: [
        'indian butter chicken murg makhani restaurant',
        'butter chicken curry indian restaurant authentic',
        'murg makhani traditional indian curry',
        'indian chicken curry butter tomato'
      ]
    },
    {
      dish: 'Chicken Biryani', 
      searches: [
        'indian chicken biryani hyderabadi authentic',
        'chicken biryani basmati rice indian restaurant',
        'hyderabadi biryani chicken traditional',
        'indian biryani chicken saffron basmati'
      ]
    },
    {
      dish: 'Masala Tea',
      searches: [
        'indian masala chai traditional tea',
        'masala chai cardamom ginger indian',
        'indian tea chai masala spiced',
        'traditional chai masala indian tea'
      ]
    },
    {
      dish: 'Paneer Tikka',
      searches: [
        'indian paneer tikka tandoor grilled',
        'paneer tikka indian cottage cheese',
        'tandoori paneer tikka indian authentic',
        'indian grilled paneer tikka restaurant'
      ]
    }
  ];

  for (const dishTest of specificSearches) {
    console.log(`🍽️ TESTING: ${dishTest.dish}`);
    console.log('─'.repeat(50));
    
    for (let i = 0; i < dishTest.searches.length; i++) {
      const searchQuery = dishTest.searches[i];
      console.log(`\n${i + 1}. Query: "${searchQuery}"`);
      
      try {
        const response = await axios.get(`https://api.unsplash.com/search/photos`, {
          timeout: 10000,
          headers: headers,
          params: {
            query: searchQuery,
            per_page: 5,
            orientation: 'landscape',
            content_filter: 'high'
          }
        });

        if (response.data && response.data.results && response.data.results.length > 0) {
          console.log(`   ✅ Found ${response.data.results.length} results`);
          
          // Show top 3 results with their descriptions
          for (let j = 0; j < Math.min(3, response.data.results.length); j++) {
            const photo = response.data.results[j];
            const imageId = photo.id;
            const description = photo.description || photo.alt_description || 'No description';
            const tags = photo.tags ? photo.tags.map(tag => tag.title).join(', ') : 'No tags';
            
            console.log(`   ${j + 1}. ID: ${imageId}`);
            console.log(`      Desc: ${description.substring(0, 60)}...`);
            console.log(`      Tags: ${tags.substring(0, 60)}...`);
            console.log(`      URL: ${photo.urls.regular.substring(0, 60)}...`);
          }
        } else {
          console.log('   ❌ No results found');
        }
        
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(80) + '\n');
  }

  console.log('💡 RECOMMENDATIONS:');
  console.log('   1. The searches above show which queries return the most Indian images');
  console.log('   2. Look for images with Indian-specific tags and descriptions');
  console.log('   3. Consider creating a curated list of good image IDs');
  console.log('   4. If still not Indian enough, we may need alternative image sources');
}

testSpecificIndianImages().catch(console.error);