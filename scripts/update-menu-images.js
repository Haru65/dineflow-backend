const { dbAll, dbRun, initializeDatabase } = require('../database-postgres');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Unsplash API configuration
const UNSPLASH_ACCESS_KEY = 'YOUR_UNSPLASH_ACCESS_KEY'; // Replace with your Unsplash API key
const UNSPLASH_API_URL = 'https://api.unsplash.com/search/photos';

// Alternative: Use Pexels API
const PEXELS_API_KEY = 'YOUR_PEXELS_API_KEY'; // Replace with your Pexels API key
const PEXELS_API_URL = 'https://api.pexels.com/v1/search';

// Food image service configuration
const IMAGE_SERVICE = 'unsplash'; // 'unsplash' or 'pexels' or 'foodish'

class MenuImageUpdater {
  constructor() {
    this.processedImages = new Set();
    this.imageCache = new Map();
  }

  /**
   * Search for food images using Unsplash API
   */
  async searchUnsplashImage(dishName) {
    try {
      const searchQuery = `${dishName} food dish cuisine`;
      const response = await axios.get(UNSPLASH_API_URL, {
        params: {
          query: searchQuery,
          per_page: 1,
          orientation: 'landscape'
        },
        headers: {
          'Authorization': `Client-ID ${UNSPLASH_ACCESS_KEY}`
        }
      });

      if (response.data.results && response.data.results.length > 0) {
        const image = response.data.results[0];
        return {
          url: image.urls.regular,
          thumbnail: image.urls.small,
          attribution: `Photo by ${image.user.name} on Unsplash`,
          download_url: image.links.download_location
        };
      }
      return null;
    } catch (error) {
      console.error(`Error searching Unsplash for ${dishName}:`, error.message);
      return null;
    }
  }

  /**
   * Search for food images using Pexels API
   */
  async searchPexelsImage(dishName) {
    try {
      const searchQuery = `${dishName} food dish`;
      const response = await axios.get(PEXELS_API_URL, {
        params: {
          query: searchQuery,
          per_page: 1,
          orientation: 'landscape'
        },
        headers: {
          'Authorization': PEXELS_API_KEY
        }
      });

      if (response.data.photos && response.data.photos.length > 0) {
        const photo = response.data.photos[0];
        return {
          url: photo.src.medium,
          thumbnail: photo.src.small,
          attribution: `Photo by ${photo.photographer} on Pexels`,
          photographer: photo.photographer
        };
      }
      return null;
    } catch (error) {
      console.error(`Error searching Pexels for ${dishName}:`, error.message);
      return null;
    }
  }

  /**
   * Get random food image from Foodish API (free, no API key required)
   */
  async getFoodishImage(dishName) {
    try {
      // Foodish provides random food images by category
      const categories = ['biryani', 'burger', 'butter-chicken', 'dessert', 'dosa', 'idly', 'pasta', 'pizza', 'rice', 'samosa'];
      
      // Try to match dish name with available categories
      const dishLower = dishName.toLowerCase();
      let category = 'biryani'; // default
      
      for (const cat of categories) {
        if (dishLower.includes(cat) || dishLower.includes(cat.replace('-', ' '))) {
          category = cat;
          break;
        }
      }
      
      // Map common dish types to categories
      if (dishLower.includes('chicken') || dishLower.includes('curry')) category = 'butter-chicken';
      else if (dishLower.includes('pizza')) category = 'pizza';
      else if (dishLower.includes('burger')) category = 'burger';
      else if (dishLower.includes('pasta')) category = 'pasta';
      else if (dishLower.includes('rice')) category = 'rice';
      else if (dishLower.includes('dessert') || dishLower.includes('sweet')) category = 'dessert';

      const response = await axios.get(`https://foodish-api.herokuapp.com/api/images/${category}`);
      
      if (response.data && response.data.image) {
        return {
          url: response.data.image,
          thumbnail: response.data.image,
          attribution: 'Image from Foodish API',
          category: category
        };
      }
      return null;
    } catch (error) {
      console.error(`Error getting Foodish image for ${dishName}:`, error.message);
      return null;
    }
  }

  /**
   * Get image based on configured service
   */
  async getImageForDish(dishName) {
    // Check cache first
    if (this.imageCache.has(dishName)) {
      return this.imageCache.get(dishName);
    }

    let imageData = null;

    switch (IMAGE_SERVICE) {
      case 'unsplash':
        imageData = await this.searchUnsplashImage(dishName);
        break;
      case 'pexels':
        imageData = await this.searchPexelsImage(dishName);
        break;
      case 'foodish':
      default:
        imageData = await this.getFoodishImage(dishName);
        break;
    }

    // Cache the result
    if (imageData) {
      this.imageCache.set(dishName, imageData);
    }

    return imageData;
  }

  /**
   * Update menu item with image URL
   */
  async updateMenuItemImage(itemId, imageUrl, attribution = null) {
    try {
      await dbRun(
        'UPDATE menu_items SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [imageUrl, itemId]
      );
      
      console.log(`✅ Updated menu item ${itemId} with image: ${imageUrl}`);
      
      // Optionally store attribution info (you might want to add an attribution column)
      if (attribution) {
        console.log(`   Attribution: ${attribution}`);
      }
      
      return true;
    } catch (error) {
      console.error(`❌ Error updating menu item ${itemId}:`, error.message);
      return false;
    }
  }

  /**
   * Process all menu items and update with images
   */
  async updateAllMenuImages(tenantId = null) {
    try {
      console.log('🍽️  Starting menu image update process...\n');

      // Get all menu items (optionally filter by tenant)
      let query = 'SELECT id, name, image_url, tenant_id FROM menu_items WHERE is_available = 1';
      let params = [];
      
      if (tenantId) {
        query += ' AND tenant_id = $1';
        params = [tenantId];
      }
      
      query += ' ORDER BY name';

      const menuItems = await dbAll(query, params);
      
      if (menuItems.length === 0) {
        console.log('No menu items found.');
        return;
      }

      console.log(`Found ${menuItems.length} menu items to process.\n`);

      let updated = 0;
      let skipped = 0;
      let failed = 0;

      for (const item of menuItems) {
        console.log(`Processing: ${item.name} (ID: ${item.id})`);

        // Skip if already has an image (unless force update)
        if (item.image_url && !process.argv.includes('--force')) {
          console.log(`  ⏭️  Skipping - already has image: ${item.image_url}`);
          skipped++;
          continue;
        }

        // Get image for this dish
        const imageData = await this.getImageForDish(item.name);
        
        if (imageData) {
          const success = await this.updateMenuItemImage(
            item.id, 
            imageData.url, 
            imageData.attribution
          );
          
          if (success) {
            updated++;
          } else {
            failed++;
          }
        } else {
          console.log(`  ❌ No image found for: ${item.name}`);
          failed++;
        }

        // Add delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('\n📊 Update Summary:');
      console.log(`✅ Updated: ${updated}`);
      console.log(`⏭️  Skipped: ${skipped}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`📝 Total: ${menuItems.length}`);

    } catch (error) {
      console.error('Error in updateAllMenuImages:', error);
    }
  }

  /**
   * Update images for specific menu items by name pattern
   */
  async updateImagesByPattern(pattern, tenantId = null) {
    try {
      console.log(`🔍 Searching for menu items matching pattern: "${pattern}"\n`);

      let query = 'SELECT id, name, image_url, tenant_id FROM menu_items WHERE is_available = 1 AND LOWER(name) LIKE LOWER($1)';
      let params = [`%${pattern}%`];
      
      if (tenantId) {
        query += ' AND tenant_id = $2';
        params.push(tenantId);
      }

      const menuItems = await dbAll(query, params);
      
      if (menuItems.length === 0) {
        console.log(`No menu items found matching pattern: "${pattern}"`);
        return;
      }

      console.log(`Found ${menuItems.length} matching items.\n`);

      for (const item of menuItems) {
        console.log(`Processing: ${item.name}`);
        
        const imageData = await this.getImageForDish(item.name);
        
        if (imageData) {
          await this.updateMenuItemImage(item.id, imageData.url, imageData.attribution);
        } else {
          console.log(`  ❌ No image found for: ${item.name}`);
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      }

    } catch (error) {
      console.error('Error in updateImagesByPattern:', error);
    }
  }
}

// CLI Usage
async function main() {
  try {
    await initializeDatabase();
    
    const updater = new MenuImageUpdater();
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      console.log(`
🍽️  Menu Image Updater

Usage:
  node update-menu-images.js [options]

Options:
  --all                    Update all menu items
  --tenant <tenant_id>     Update items for specific tenant only
  --pattern <pattern>      Update items matching name pattern
  --force                  Update even if image already exists
  --service <service>      Use specific image service (unsplash|pexels|foodish)
  --help, -h              Show this help message

Examples:
  node update-menu-images.js --all
  node update-menu-images.js --tenant abc123 --force
  node update-menu-images.js --pattern "chicken"
  node update-menu-images.js --all --service foodish

Note: For Unsplash/Pexels, you need to set API keys in the script.
      Foodish API is free and doesn't require API keys.
      `);
      return;
    }

    const tenantId = args.includes('--tenant') ? args[args.indexOf('--tenant') + 1] : null;
    const pattern = args.includes('--pattern') ? args[args.indexOf('--pattern') + 1] : null;
    
    if (pattern) {
      await updater.updateImagesByPattern(pattern, tenantId);
    } else {
      await updater.updateAllMenuImages(tenantId);
    }

  } catch (error) {
    console.error('Script error:', error);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = MenuImageUpdater;