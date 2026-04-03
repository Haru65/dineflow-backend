/**
 * Test: Verify public menu API returns image_url for menu items
 */

require('dotenv').config();
const axios = require('axios');
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

async function testPublicMenuImagesApi() {
  try {
    console.log('\n🔍 Testing Public Menu API for Image URLs\n');
    console.log(`Base URL: ${BASE_URL}`);
    
    // You need to provide test values or get them from the database
    const restaurantSlug = 'test-restaurant'; // Change this to a real slug
    const tableIdentifier = '1'; // Change this to a real table identifier
    
    console.log(`\n📋 Fetching menu for: ${restaurantSlug} / ${tableIdentifier}\n`);
    
    const response = await axios.get(
      `${BASE_URL}/api/public/menu/${restaurantSlug}/${tableIdentifier}`
    );
    
    if (response.data && response.data.data) {
      const { restaurant, table, categories } = response.data.data;
      
      console.log(`✅ Successfully fetched menu for: ${restaurant.name}\n`);
      console.log(`📊 Restaurant Details:`);
      console.log(`   - ID: ${restaurant.id}`);
      console.log(`   - Name: ${restaurant.name}`);
      console.log(`   - Logo URL: ${restaurant.logo_url ? '✓ Present' : '✗ Missing'}\n`);
      
      console.log(`📍 Table: ${table.name} (${table.identifier})\n`);
      
      console.log(`📂 Categories: ${categories.length}\n`);
      
      let totalItems = 0;
      let itemsWithImages = 0;
      
      categories.forEach((category, catIndex) => {
        console.log(`\n📦 Category ${catIndex + 1}: ${category.name}`);
        console.log(`   Items: ${category.items ? category.items.length : 0}`);
        
        if (category.items && category.items.length > 0) {
          category.items.forEach((item, itemIndex) => {
            totalItems++;
            const hasImage = item.image_url ? true : false;
            if (hasImage) itemsWithImages++;
            
            console.log(`\n   📝 Item ${itemIndex + 1}: ${item.name}`);
            console.log(`      - Price: ₹${item.price}`);
            console.log(`      - Image URL: ${hasImage ? '✓ ' + item.image_url.substring(0, 50) + '...' : '✗ Missing'}`);
            console.log(`      - Available: ${item.is_available ? 'Yes' : 'No'}`);
            console.log(`      - Veg: ${item.is_veg ? 'Yes' : 'No'}`);
          });
        }
      });
      
      console.log(`\n📊 Summary:`);
      console.log(`   Total items: ${totalItems}`);
      console.log(`   Items with images: ${itemsWithImages}`);
      console.log(`   Percentage: ${totalItems > 0 ? Math.round((itemsWithImages / totalItems) * 100) : 0}%`);
      
      if (itemsWithImages === 0) {
        console.log(`\n⚠️  WARNING: No items have image_url! Images won't display in customer view.`);
      } else if (itemsWithImages < totalItems) {
        console.log(`\n⚠️  WARNING: Some items missing images. Auto-generate images in admin panel.`);
      } else {
        console.log(`\n✅ All items have images! Customer view should show images correctly.`);
      }
    }
  } catch (error) {
    console.error('\n❌ Error testing public menu API:');
    console.error(`   Status: ${error.response?.status}`);
    console.error(`   Message: ${error.response?.data?.error || error.message}`);
    console.error(`   Details: ${error.response?.data?.details || ''}`);
  }
}

testPublicMenuImagesApi();
