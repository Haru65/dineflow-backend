const { dbAll, dbRun, initializeDatabase } = require('../database-postgres');
const axios = require('axios');

/**
 * Simple Menu Image Updater using free APIs
 * No API keys required - uses Foodish API and Lorem Picsum
 */

class SimpleMenuImageUpdater {
  constructor() {
    this.imageCache = new Map();
  }

  /**
   * Get food image from Foodish API (free, no API key)
   */
  async getFoodImage(dishName) {
    try {
      const dishLower = dishName.toLowerCase();
      
      // Map dish names to Foodish categories
      let category = 'biryani'; // default
      
      if (dishLower.includes('biryani')) category = 'biryani';
      else if (dishLower.includes('burger')) category = 'burger';
      else if (dishLower.includes('chicken') || dishLower.includes('curry')) category = 'butter-chicken';
      else if (dishLower.includes('dessert') || dishLower.includes('sweet') || dishLower.includes('cake') || dishLower.includes('ice cream')) category = 'dessert';
      else if (dishLower.includes('dosa')) category = 'dosa';
      else if (dishLower.includes('idly') || dishLower.includes('idli')) category = 'idly';
      else if (dishLower.includes('pasta')) category = 'pasta';
      else if (dishLower.includes('pizza')) category = 'pizza';
      else if (dishLower.includes('rice')) category = 'rice';
      else if (dishLower.includes('samosa')) category = 'samosa';
      
      const response = await axios.get(`https://foodish-api.herokuapp.com/api/images/${category}`);
      
      if (response.data && response.data.image) {
        return {
          url: response.data.image,
          source: 'Foodish API',
          category: category
        };
      }
      
      return null;
    } catch (error) {
      console.error(`Error getting image for ${dishName}:`, error.message);
      return null;
    }
  }

  /**
   * Fallback: Get random food image from Lorem Picsum
   */
  async getFallbackImage(dishName) {
    try {
      // Generate a consistent seed based on dish name for consistent images
      const seed = dishName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const imageUrl = `https://picsum.photos/seed/${seed}/400/300`;
      
      return {
        url: imageUrl,
        source: 'Lorem Picsum',
        seed: seed
      };
    } catch (error) {
      console.error(`Error getting fallback image for ${dishName}:`, error.message);
      return null;
    }
  }

  /**
   * Get the best available image for a dish
   */
  async getImageForDish(dishName) {
    // Check cache first
    if (this.imageCache.has(dishName)) {
      return this.imageCache.get(dishName);
    }

    console.log(`  🔍 Searching image for: ${dishName}`);

    // Try Foodish API first
    let imageData = await this.getFoodImage(dishName);
    
    // If Foodish fails, use fallback
    if (!imageData) {
      console.log(`  ⚠️  Foodish API failed, using fallback for: ${dishName}`);
      imageData = await this.getFallbackImage(dishName);
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
  async updateMenuItemImage(itemId, imageUrl, source = null) {
    try {
      await dbRun(
        'UPDATE menu_items SET image_url = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [imageUrl, itemId]
      );
      
      console.log(`  ✅ Updated with image from ${source}`);
      return true;
    } catch (error) {
      console.error(`  ❌ Error updating menu item ${itemId}:`, error.message);
      return false;
    }
  }

  /**
   * Process all menu items and update with images
   */
  async updateAllMenuImages(options = {}) {
    try {
      const { tenantId = null, force = false, pattern = null } = options;
      
      console.log('🍽️  Starting menu image update...\n');

      // Build query
      let query = 'SELECT id, name, image_url, tenant_id FROM menu_items WHERE is_available = 1';
      let params = [];
      
      if (tenantId) {
        query += ' AND tenant_id = $1';
        params = [tenantId];
      }
      
      if (pattern) {
        const paramIndex = params.length + 1;
        query += ` AND LOWER(name) LIKE LOWER($${paramIndex})`;
        params.push(`%${pattern}%`);
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
        console.log(`📝 Processing: ${item.name} (ID: ${item.id})`);

        // Skip if already has an image (unless force update)
        if (item.image_url && !force) {
          console.log(`  ⏭️  Already has image, skipping`);
          skipped++;
          continue;
        }

        // Get image for this dish
        const imageData = await this.getImageForDish(item.name);
        
        if (imageData) {
          const success = await this.updateMenuItemImage(
            item.id, 
            imageData.url, 
            imageData.source
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

        // Small delay to be respectful to APIs
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      console.log('\n📊 Summary:');
      console.log(`✅ Updated: ${updated}`);
      console.log(`⏭️  Skipped: ${skipped}`);
      console.log(`❌ Failed: ${failed}`);
      console.log(`📝 Total: ${menuItems.length}`);

    } catch (error) {
      console.error('Error in updateAllMenuImages:', error);
    }
  }

  /**
   * Show current menu items and their image status
   */
  async showMenuStatus(tenantId = null) {
    try {
      let query = 'SELECT id, name, image_url, tenant_id FROM menu_items WHERE is_available = 1';
      let params = [];
      
      if (tenantId) {
        query += ' AND tenant_id = $1';
        params = [tenantId];
      }
      
      query += ' ORDER BY name';

      const menuItems = await dbAll(query, params);
      
      console.log('\n📋 Current Menu Items Status:\n');
      
      let withImages = 0;
      let withoutImages = 0;
      
      menuItems.forEach(item => {
        const hasImage = item.image_url ? '✅' : '❌';
        const imageInfo = item.image_url ? `(${item.image_url.substring(0, 50)}...)` : '(no image)';
        
        console.log(`${hasImage} ${item.name} ${imageInfo}`);
        
        if (item.image_url) {
          withImages++;
        } else {
          withoutImages++;
        }
      });
      
      console.log(`\n📊 Status Summary:`);
      console.log(`✅ With images: ${withImages}`);
      console.log(`❌ Without images: ${withoutImages}`);
      console.log(`📝 Total items: ${menuItems.length}`);
      
    } catch (error) {
      console.error('Error showing menu status:', error);
    }
  }
}

// CLI Usage
async function main() {
  try {
    await initializeDatabase();
    
    const updater = new SimpleMenuImageUpdater();
    const args = process.argv.slice(2);
    
    if (args.includes('--help') || args.includes('-h')) {
      console.log(`
🍽️  Simple Menu Image Updater

Usage:
  node simple-menu-images.js [command] [options]

Commands:
  update                   Update menu item images (default)
  status                   Show current image status

Options:
  --tenant <tenant_id>     Process specific tenant only
  --pattern <pattern>      Process items matching name pattern
  --force                  Update even if image already exists
  --help, -h              Show this help message

Examples:
  node simple-menu-images.js update
  node simple-menu-images.js update --tenant abc123
  node simple-menu-images.js update --pattern "chicken" --force
  node simple-menu-images.js status
  node simple-menu-images.js status --tenant abc123

Features:
  - Uses free Foodish API (no API key required)
  - Fallback to Lorem Picsum for consistent images
  - Caches results to avoid duplicate API calls
  - Respects API rate limits with delays
      `);
      return;
    }

    const command = args[0] || 'update';
    const tenantId = args.includes('--tenant') ? args[args.indexOf('--tenant') + 1] : null;
    const pattern = args.includes('--pattern') ? args[args.indexOf('--pattern') + 1] : null;
    const force = args.includes('--force');
    
    if (command === 'status') {
      await updater.showMenuStatus(tenantId);
    } else {
      await updater.updateAllMenuImages({ tenantId, force, pattern });
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

module.exports = SimpleMenuImageUpdater;