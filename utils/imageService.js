const axios = require('axios');

class ImageService {
  constructor() {
    this.imageCache = new Map();
    this.googleApiKey = process.env.GOOGLE_API_KEY;
    this.googleSearchEngineId = process.env.GOOGLE_SEARCH_ENGINE_ID;
  }

  /**
   * Get food image from Unsplash API (free tier: 50 requests/hour)
   */
  async getUnsplashImage(dishName) {
    try {
      const unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
      if (!unsplashAccessKey) {
        console.log('⚠️ Unsplash API key not configured, skipping Unsplash search');
        return null;
      }

      const searchQuery = `${dishName} food dish`;
      console.log(`🔍 Searching Unsplash for: ${searchQuery}`);
      
      const response = await axios.get('https://api.unsplash.com/search/photos', {
        params: {
          query: searchQuery,
          per_page: 3,
          orientation: 'landscape',
          content_filter: 'high'
        },
        headers: {
          'Authorization': `Client-ID ${unsplashAccessKey}`
        },
        timeout: 8000
      });

      if (response.data && response.data.results && response.data.results.length > 0) {
        const photo = response.data.results[0];
        const imageUrl = photo.urls.regular; // High quality but not too large
        
        console.log(`✅ Found Unsplash image for ${dishName}: ${imageUrl}`);
        return {
          url: imageUrl,
          source: 'Unsplash',
          photographer: photo.user.name,
          description: photo.description || photo.alt_description
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting Unsplash image for ${dishName}:`, error.message);
      return null;
    }
  }

  /**
   * Get food image from Pexels API (free tier: 200 requests/hour)
   */
  async getPexelsImage(dishName) {
    try {
      const pexelsApiKey = process.env.PEXELS_API_KEY;
      if (!pexelsApiKey) {
        console.log('⚠️ Pexels API key not configured, skipping Pexels search');
        return null;
      }

      const searchQuery = `${dishName} food dish`;
      console.log(`🔍 Searching Pexels for: ${searchQuery}`);
      
      const response = await axios.get('https://api.pexels.com/v1/search', {
        params: {
          query: searchQuery,
          per_page: 3,
          orientation: 'landscape'
        },
        headers: {
          'Authorization': pexelsApiKey
        },
        timeout: 8000
      });

      if (response.data && response.data.photos && response.data.photos.length > 0) {
        const photo = response.data.photos[0];
        const imageUrl = photo.src.large; // High quality
        
        console.log(`✅ Found Pexels image for ${dishName}: ${imageUrl}`);
        return {
          url: imageUrl,
          source: 'Pexels',
          photographer: photo.photographer,
          description: photo.alt
        };
      }
      
      return null;
    } catch (error) {
      console.error(`❌ Error getting Pexels image for ${dishName}:`, error.message);
      return null;
    }
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
      
      console.log(`🔍 Fetching ${category} image for: ${dishName}`);
      
      const response = await axios.get(`https://foodish-api.herokuapp.com/api/images/${category}`, {
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

    let imageData = null;

    // Try Unsplash first (free, high quality)
    imageData = await this.getUnsplashImage(dishName);

    // If Unsplash fails, try Pexels (free, good quality)
    if (!imageData) {
      imageData = await this.getPexelsImage(dishName);
    }

    // If both fail, try Foodish API (free, limited categories)
    if (!imageData) {
      const foodishResult = await this.getFoodImage(dishName);
      if (foodishResult) {
        imageData = {
          url: foodishResult,
          source: 'Foodish API'
        };
      }
    }
    
    // If all fail, use fallback
    if (!imageData) {
      const fallbackUrl = this.getFallbackImage(dishName);
      imageData = {
        url: fallbackUrl,
        source: 'Lorem Picsum Fallback'
      };
    }

    // Cache the result
    if (imageData) {
      this.imageCache.set(dishName, imageData.url);
    }

    return imageData?.url;
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
}

module.exports = new ImageService();