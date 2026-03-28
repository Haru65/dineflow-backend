const axios = require('axios');

class ImageService {
  constructor() {
    this.imageCache = new Map();
  }

  /**
   * Get food image from Foodish API (free, no API key required)
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
      
      console.log(`🔍 Fetching ${category} image for: ${dishName}`);
      
      const response = await axios.get(`https://foodish-api.com/api/images/${category}`, {
        timeout: 5000 // 5 second timeout
      });
      
      if (response.data && response.data.image) {
        console.log(`✅ Found image for ${dishName}: ${response.data.image}`);
        return response.data.image;
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting image for ${dishName}:`, error.message);
      return null;
    }
  }

  /**
   * Fallback: Get consistent placeholder image
   */
  getFallbackImage(dishName) {
    try {
      // Generate a consistent seed based on dish name for consistent images
      const seed = dishName.toLowerCase().replace(/[^a-z0-9]/g, '');
      const imageUrl = `https://picsum.photos/seed/${seed}/400/300`;
      
      console.log(`🔄 Using fallback image for ${dishName}: ${imageUrl}`);
      return imageUrl;
    } catch (error) {
      console.error(`❌ Error getting fallback image for ${dishName}:`, error.message);
      return null;
    }
  }

  /**
   * Get the best available image for a dish
   */
  async getImageForDish(dishName) {
    // Check cache first
    if (this.imageCache.has(dishName)) {
      console.log(`📋 Using cached image for: ${dishName}`);
      return this.imageCache.get(dishName);
    }

    // Try Foodish API first
    let imageUrl = await this.getFoodImage(dishName);
    
    // If Foodish fails, use fallback
    if (!imageUrl) {
      imageUrl = this.getFallbackImage(dishName);
    }

    // Cache the result
    if (imageUrl) {
      this.imageCache.set(dishName, imageUrl);
    }

    return imageUrl;
  }

  /**
   * Auto-fetch image for new menu item (async, non-blocking)
   */
  async autoFetchImageForMenuItem(dishName) {
    try {
      const imageUrl = await this.getImageForDish(dishName);
      return imageUrl;
    } catch (error) {
      console.error(`Auto-fetch image failed for ${dishName}:`, error.message);
      // Return fallback even if there's an error
      return this.getFallbackImage(dishName);
    }
  }

  /**
   * Clear the image cache
   */
  clearCache() {
    this.imageCache.clear();
    console.log('🗑️ Image cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.imageCache.size,
      keys: Array.from(this.imageCache.keys())
    };
  }
}

module.exports = new ImageService();