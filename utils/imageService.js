const axios = require('axios');

class ImageService {
  constructor() {
    this.imageCache = new Map();
    this.unsplashAccessKey = process.env.UNSPLASH_ACCESS_KEY;
    this.unsplashSecretKey = process.env.UNSPLASH_SECRET_KEY;
    this.unsplashAppName = process.env.UNSPLASH_APP_NAME || 'DineFlow';
    this.rateLimitWarningShown = false;
  }

  /**
   * Check if API key is properly configured
   */
  isApiKeyConfigured() {
    return this.unsplashAccessKey &&
           this.unsplashAccessKey !== 'your_unsplash_access_key_here' &&
           this.unsplashAccessKey.trim() !== '';
  }

  /**
   * Get authorization headers
   * Uses Access Key for standard requests (searching, fetching photos)
   * Secret Key is reserved for OAuth operations (user authentication, uploads, etc.)
   */
  getAuthHeaders() {
    return {
      'Authorization': `Client-ID ${this.unsplashAccessKey}`,
      'Accept-Version': 'v1',
      'User-Agent': this.unsplashAppName
    };
  }

  /**
   * Trigger download endpoint (Unsplash API requirement)
   * This is REQUIRED by Unsplash API guidelines to track photo usage
   */
  async triggerDownload(downloadLocation) {
    try {
      if (!downloadLocation) return;

      // Trigger download without waiting for response (fire-and-forget)
      axios.get(downloadLocation, {
        headers: this.getAuthHeaders(),
        timeout: 5000
      }).catch(err => {
        // Silent fail - don't block image return
        console.warn('⚠️ Download tracking failed (non-critical):', err.message);
      });
    } catch (error) {
      // Silent fail - this is non-critical
    }
  }

  /**
   * Get food image from Unsplash API
   */
  async getFoodImage(dishName) {
    try {
      if (!this.unsplashAccessKey) {
        console.error('❌ UNSPLASH_ACCESS_KEY not configured in .env file');
        console.error('   Please set your Unsplash API key to enable image fetching');
        return null;
      }

      if (!this.isApiKeyConfigured()) {
        console.error('❌ UNSPLASH_ACCESS_KEY is still set to placeholder value');
        console.error('   Please update it with your real Unsplash API key from https://unsplash.com/developers');
        return null;
      }

      const dishLower = dishName.toLowerCase();

      // Map dish names to better search terms for Unsplash
      let searchQuery = 'food'; // default

      if (dishLower.includes('biryani')) searchQuery = 'biryani indian rice food';
      else if (dishLower.includes('burger')) searchQuery = 'burger food';
      else if (dishLower.includes('chicken') || dishLower.includes('curry')) searchQuery = 'chicken curry indian food';
      else if (dishLower.includes('dessert') || dishLower.includes('sweet') || dishLower.includes('cake') || dishLower.includes('ice cream')) searchQuery = 'dessert food sweet';
      else if (dishLower.includes('dosa')) searchQuery = 'dosa south indian food';
      else if (dishLower.includes('idly') || dishLower.includes('idli')) searchQuery = 'idli south indian food';
      else if (dishLower.includes('pasta')) searchQuery = 'pasta food italian';
      else if (dishLower.includes('pizza')) searchQuery = 'pizza food';
      else if (dishLower.includes('rice')) searchQuery = 'rice food dish';
      else if (dishLower.includes('samosa')) searchQuery = 'samosa indian snack food';
      else if (dishLower.includes('naan') || dishLower.includes('roti') || dishLower.includes('paratha')) searchQuery = 'naan bread indian';
      else if (dishLower.includes('paneer')) searchQuery = 'paneer indian food';
      else if (dishLower.includes('dal')) searchQuery = 'dal lentil indian food';
      else if (dishLower.includes('tea') || dishLower.includes('chai')) searchQuery = 'indian tea chai beverage';
      else if (dishLower.includes('coffee')) searchQuery = 'coffee beverage';
      else if (dishLower.includes('juice')) searchQuery = `${dishName.split(' ')[0]} juice beverage`;
      else searchQuery = `${dishName} food`;

      console.log(`🔍 Searching Unsplash for: ${searchQuery}`);

      const response = await axios.get(`https://api.unsplash.com/search/photos`, {
        timeout: 10000, // 10 second timeout
        headers: this.getAuthHeaders(),
        params: {
          query: searchQuery,
          per_page: 10,
          orientation: 'landscape',
          content_filter: 'high' // Filter out inappropriate content
        }
      });

      // Check rate limit headers
      const remaining = response.headers['x-ratelimit-remaining'];
      if (remaining && parseInt(remaining) < 10 && !this.rateLimitWarningShown) {
        console.warn(`⚠️ Unsplash API rate limit warning: ${remaining} requests remaining`);
        this.rateLimitWarningShown = true;
      }

      if (response.data && response.data.results && response.data.results.length > 0) {
        // Get a random image from the first few results
        const randomIndex = Math.floor(Math.random() * Math.min(response.data.results.length, 5));
        const photo = response.data.results[randomIndex];
        const imageUrl = photo.urls.regular;

        // IMPORTANT: Trigger download endpoint (Unsplash API requirement)
        if (photo.links && photo.links.download_location) {
          this.triggerDownload(photo.links.download_location);
        }

        console.log(`✅ Found Unsplash image for ${dishName}: ${imageUrl}`);
        return imageUrl;
      }

      console.log(`⚠️ No images found for ${dishName} on Unsplash`);
      return null;
    } catch (error) {
      // Enhanced error handling
      if (error.response) {
        const status = error.response.status;

        if (status === 401) {
          console.error(`❌ Unsplash API Authentication Error (401)`);
          console.error('   Your API key is invalid or expired');
          console.error('   Please check your UNSPLASH_ACCESS_KEY in .env file');
        } else if (status === 403) {
          console.error(`❌ Unsplash API Access Forbidden (403)`);
          console.error('   Your API key may not have the required permissions');
        } else if (status === 429) {
          console.error(`❌ Unsplash API Rate Limit Exceeded (429)`);
          console.error('   You have exceeded the 50 requests/hour limit for free tier');
          console.error('   Consider waiting or upgrading to paid plan (5000 requests/hour)');
        } else {
          console.error(`❌ Unsplash API Error (${status}): ${error.message}`);
        }
      } else if (error.code === 'ECONNABORTED') {
        console.error(`❌ Unsplash API Timeout for ${dishName}`);
      } else {
        console.error(`❌ Network error getting Unsplash image for ${dishName}:`, error.message);
      }
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

    // Try Unsplash API first
    let imageUrl = await this.getFoodImage(dishName);

    // If Unsplash fails, use fallback
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
    this.rateLimitWarningShown = false;
    console.log('🗑️ Image cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.imageCache.size,
      keys: Array.from(this.imageCache.keys()),
      configured: this.isApiKeyConfigured(),
      appName: this.unsplashAppName
    };
  }

  /**
   * Get configuration status
   */
  getConfigStatus() {
    return {
      accessKeyConfigured: this.isApiKeyConfigured(),
      secretKeyConfigured: Boolean(this.unsplashSecretKey && this.unsplashSecretKey !== 'your_unsplash_secret_key_here'),
      appName: this.unsplashAppName,
      cacheSize: this.imageCache.size
    };
  }
}

module.exports = new ImageService();