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
   * Get optimized search query for dish name
   */
  getSearchQuery(dishName) {
    const dishLower = dishName.toLowerCase().trim();
    
    // Exact dish name mappings (FOCUS ON PREPARED FOOD/DRINKS ONLY)
    const exactMappings = {
      // Biryani varieties - emphasize prepared dish
      'chicken biryani': 'chicken biryani dish served plate indian restaurant',
      'mutton biryani': 'mutton biryani dish served plate indian restaurant',
      'veg biryani': 'vegetable biryani dish served plate indian restaurant',
      'egg biryani': 'egg biryani dish served plate indian restaurant',
      'fish biryani': 'fish biryani dish served plate indian restaurant',
      
      // Chicken dishes - emphasize cooked/prepared dishes
      'butter chicken': 'butter chicken curry dish served bowl indian restaurant',
      'chicken tikka masala': 'chicken tikka masala curry dish served indian restaurant',
      'chicken curry': 'chicken curry dish served bowl indian restaurant',
      'chicken 65': 'chicken 65 fried dish served plate indian restaurant',
      'tandoori chicken': 'tandoori chicken grilled dish served plate indian restaurant',
      'chicken korma': 'chicken korma curry dish served bowl indian restaurant',
      'chicken vindaloo': 'chicken vindaloo curry dish served bowl indian restaurant',
      
      // Paneer dishes - emphasize prepared cottage cheese dishes
      'paneer butter masala': 'paneer butter masala curry dish served bowl indian restaurant',
      'paneer tikka': 'paneer tikka grilled dish served plate indian restaurant',
      'palak paneer': 'palak paneer curry dish served bowl indian restaurant',
      'kadai paneer': 'kadai paneer curry dish served bowl indian restaurant',
      'paneer makhani': 'paneer makhani curry dish served bowl indian restaurant',
      
      // Dal varieties - emphasize prepared lentil dishes
      'dal tadka': 'dal tadka lentil curry dish served bowl indian restaurant',
      'dal makhani': 'dal makhani lentil curry dish served bowl indian restaurant',
      'dal fry': 'dal fry lentil curry dish served bowl indian restaurant',
      'sambar': 'sambar lentil curry dish served bowl south indian restaurant',
      
      // Breads - emphasize baked/prepared breads
      'butter naan': 'butter naan bread served plate indian restaurant',
      'garlic naan': 'garlic naan bread served plate indian restaurant',
      'cheese naan': 'cheese naan bread served plate indian restaurant',
      'tandoori roti': 'tandoori roti bread served plate indian restaurant',
      'chapati': 'chapati bread served plate indian restaurant',
      'paratha': 'paratha bread served plate indian restaurant',
      
      // South Indian - emphasize prepared dishes
      'masala dosa': 'masala dosa served plate south indian restaurant',
      'plain dosa': 'plain dosa served plate south indian restaurant',
      'idli': 'idli served plate south indian restaurant',
      'vada': 'vada served plate south indian restaurant',
      'uttapam': 'uttapam served plate south indian restaurant',
      
      // Beverages - emphasize prepared drinks in cups/glasses
      'masala tea': 'masala chai tea served cup glass indian',
      'filter coffee': 'filter coffee served cup glass south indian',
      'lassi': 'lassi drink served glass indian',
      'mango lassi': 'mango lassi drink served glass indian',
      
      // Desserts - emphasize prepared sweets
      'gulab jamun': 'gulab jamun dessert served plate bowl indian',
      'rasgulla': 'rasgulla dessert served plate bowl indian',
      'kheer': 'kheer dessert served bowl indian',
      'kulfi': 'kulfi ice cream served indian',
      
      // Snacks - emphasize prepared snacks
      'samosa': 'samosa fried snack served plate indian',
      'pakora': 'pakora fried snack served plate indian',
      'chaat': 'chaat snack served plate indian',
      
      // International (keep simple)
      'pizza': 'pizza served plate',
      'burger': 'burger served plate',
      'pasta': 'pasta served plate',
      'sandwich': 'sandwich served plate',
      'french fries': 'french fries served plate',
    };
    
    // Check for exact matches first
    if (exactMappings[dishLower]) {
      return exactMappings[dishLower];
    }
    
    // Pattern-based matching (FOCUS ON PREPARED FOOD ONLY)
    if (dishLower.includes('biryani')) {
      if (dishLower.includes('chicken')) return 'chicken biryani dish served plate indian restaurant';
      if (dishLower.includes('mutton') || dishLower.includes('lamb')) return 'mutton biryani dish served plate indian restaurant';
      if (dishLower.includes('veg') || dishLower.includes('vegetable')) return 'vegetable biryani dish served plate indian restaurant';
      if (dishLower.includes('egg')) return 'egg biryani dish served plate indian restaurant';
      return 'biryani dish served plate indian restaurant';
    }
    
    if (dishLower.includes('chicken')) {
      if (dishLower.includes('butter')) return 'butter chicken curry dish served bowl indian restaurant';
      if (dishLower.includes('tikka')) return 'chicken tikka dish served plate indian restaurant';
      if (dishLower.includes('curry')) return 'chicken curry dish served bowl indian restaurant';
      if (dishLower.includes('65')) return 'chicken 65 fried dish served plate indian restaurant';
      if (dishLower.includes('tandoori')) return 'tandoori chicken dish served plate indian restaurant';
      return 'chicken dish served plate indian restaurant';
    }
    
    if (dishLower.includes('paneer')) {
      if (dishLower.includes('butter') || dishLower.includes('makhani')) return 'paneer butter masala curry dish served bowl indian restaurant';
      if (dishLower.includes('tikka')) return 'paneer tikka dish served plate indian restaurant';
      if (dishLower.includes('palak')) return 'palak paneer curry dish served bowl indian restaurant';
      return 'paneer dish served bowl indian restaurant';
    }
    
    if (dishLower.includes('dal')) {
      if (dishLower.includes('makhani')) return 'dal makhani curry dish served bowl indian restaurant';
      if (dishLower.includes('tadka')) return 'dal tadka curry dish served bowl indian restaurant';
      return 'dal curry dish served bowl indian restaurant';
    }
    
    if (dishLower.includes('naan') || dishLower.includes('roti') || dishLower.includes('paratha')) {
      if (dishLower.includes('butter')) return 'butter naan bread served plate indian restaurant';
      if (dishLower.includes('garlic')) return 'garlic naan bread served plate indian restaurant';
      if (dishLower.includes('cheese')) return 'cheese naan bread served plate indian restaurant';
      return 'naan bread served plate indian restaurant';
    }
    
    if (dishLower.includes('dosa')) {
      if (dishLower.includes('masala')) return 'masala dosa served plate south indian restaurant';
      return 'dosa served plate south indian restaurant';
    }
    
    if (dishLower.includes('tea') || dishLower.includes('chai')) {
      if (dishLower.includes('masala')) return 'masala chai tea served cup glass indian';
      return 'chai tea served cup glass indian';
    }
    
    if (dishLower.includes('coffee')) {
      if (dishLower.includes('filter')) return 'filter coffee served cup glass south indian';
      return 'coffee served cup glass';
    }
    
    if (dishLower.includes('juice')) {
      const fruitName = dishName.split(' ')[0].toLowerCase();
      return `${fruitName} juice drink served glass`;
    }
    
    if (dishLower.includes('lassi')) {
      if (dishLower.includes('mango')) return 'mango lassi drink served glass indian';
      return 'lassi drink served glass indian';
    }
    
    // Dessert patterns
    if (dishLower.includes('ice cream') || dishLower.includes('kulfi')) {
      return 'kulfi ice cream served bowl indian';
    }
    
    if (dishLower.includes('sweet') || dishLower.includes('dessert') || 
        dishLower.includes('gulab') || dishLower.includes('rasgulla') || 
        dishLower.includes('kheer')) {
      return 'indian dessert served bowl plate';
    }
    
    // International dishes (keep simple)
    if (dishLower.includes('pizza')) return 'pizza served plate';
    if (dishLower.includes('burger')) return 'burger served plate';
    if (dishLower.includes('pasta')) return 'pasta served plate';
    if (dishLower.includes('sandwich')) return 'sandwich served plate';
    
    // Generic patterns - focus on prepared food
    if (dishLower.includes('rice')) return 'rice dish served plate indian restaurant';
    if (dishLower.includes('curry')) return 'curry dish served bowl indian restaurant';
    if (dishLower.includes('fry') || dishLower.includes('fried')) return 'fried dish served plate indian restaurant';
    
    // Default: focus on prepared food
    return `${dishName} dish served plate bowl indian restaurant`;
  }

  /**
   * Get food image from Unsplash API with multiple search strategies
   */
  async getFoodImage(dishName) {
    try {
      if (!this.unsplashAccessKey) {
        throw new Error('UNSPLASH_ACCESS_KEY not configured in .env file');
      }

      if (!this.isApiKeyConfigured()) {
        throw new Error('UNSPLASH_ACCESS_KEY is still set to placeholder value');
      }

      // Try multiple ULTRA-INDIAN search strategies
      const searchStrategies = [
        this.getSearchQuery(dishName), // Primary ultra-Indian search
        `traditional indian ${dishName} desi authentic homestyle`, // Fallback 1 - force Indian
        `indian ${dishName} curry spice masala authentic`, // Fallback 2 - Indian with spices
        `${dishName} india traditional authentic desi`, // Fallback 3 - India focus
        `${dishName} indian food` // Final fallback
      ];

      for (let i = 0; i < searchStrategies.length; i++) {
        const searchQuery = searchStrategies[i];
        console.log(`🔍 Searching Unsplash (attempt ${i + 1}): "${dishName}" → "${searchQuery}"`);

        const imageUrl = await this.searchUnsplashWithQuery(searchQuery, dishName, i === 0);
        
        if (imageUrl) {
          return imageUrl;
        }
        
        // If first attempt failed, try next strategy
        if (i < searchStrategies.length - 1) {
          console.log(`⚠️ No suitable images found, trying alternative search...`);
          await new Promise(resolve => setTimeout(resolve, 500)); // Small delay between attempts
        }
      }

      console.log(`⚠️ No images found for ${dishName} with any search strategy`);
      return null;
    } catch (error) {
      // If it's a configuration error, throw it to be handled upstream
      if (error.message.includes('not configured') || error.message.includes('placeholder')) {
        throw error;
      }
      
      // If it's an API error, throw specific error
      if (error.response?.status === 401) {
        throw new Error('Invalid Unsplash API key - authentication failed');
      } else if (error.response?.status === 429) {
        throw new Error('Unsplash API rate limit exceeded - 50 requests/hour limit reached');
      } else if (error.response?.status === 403) {
        throw new Error('Unsplash API access forbidden - check API key permissions');
      }
      
      // For other errors, log and return null (will trigger fallback)
      console.error(`❌ Error in getFoodImage for ${dishName}:`, error.message);
      return null;
    }
  }

  /**
   * Search Unsplash with a specific query
   */
  async searchUnsplashWithQuery(searchQuery, dishName, useEnhancedFiltering = true) {
    try {
      const response = await axios.get(`https://api.unsplash.com/search/photos`, {
        timeout: 10000, // 10 second timeout
        headers: this.getAuthHeaders(),
        params: {
          query: searchQuery,
          per_page: useEnhancedFiltering ? 30 : 15, // More results for enhanced filtering
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
        let resultsToUse = response.data.results;

        if (useEnhancedFiltering) {
          // STRICT filtering for ONLY prepared food and drinks (not ingredients or cooking processes)
          const preparedFoodResults = response.data.results.filter(photo => {
            const description = (photo.description || '').toLowerCase();
            const altDescription = (photo.alt_description || '').toLowerCase();
            const tags = photo.tags ? photo.tags.map(tag => tag.title.toLowerCase()).join(' ') : '';
            
            const combinedText = `${description} ${altDescription} ${tags}`;
            
            // MUST have prepared food/drink keywords (not ingredients or processes)
            const preparedFoodKeywords = ['dish', 'meal', 'plate', 'bowl', 'served', 'cooked', 'prepared', 'ready', 'restaurant', 'curry', 'rice', 'bread', 'drink', 'beverage', 'cup', 'glass', 'served'];
            const hasPreparedFood = preparedFoodKeywords.some(keyword => combinedText.includes(keyword));
            
            // MUST have Indian context
            const indianKeywords = ['indian', 'india', 'curry', 'masala', 'tandoori', 'biryani', 'naan', 'dal', 'paneer', 'tikka', 'dosa', 'chai', 'lassi'];
            const hasIndian = indianKeywords.some(keyword => combinedText.includes(keyword));
            
            // EXCLUDE ingredients, raw materials, cooking processes, and non-food items
            const excludeKeywords = ['grinding', 'powder', 'spice', 'ingredient', 'raw', 'uncooked', 'market', 'shop', 'selling', 'vendor', 'street vendor', 'cooking process', 'preparation', 'making', 'recipe step', 'mortar', 'pestle', 'grinder'];
            const hasExcluded = excludeKeywords.some(keyword => combinedText.includes(keyword));
            
            // EXCLUDE non-Indian cuisines
            const nonIndianKeywords = ['chinese', 'italian', 'mexican', 'japanese', 'thai', 'american', 'french', 'mediterranean', 'korean'];
            const hasNonIndian = nonIndianKeywords.some(keyword => combinedText.includes(keyword));
            
            return hasPreparedFood && hasIndian && !hasExcluded && !hasNonIndian;
          });
          
          // If we have prepared food results, use them
          if (preparedFoodResults.length > 0) {
            resultsToUse = preparedFoodResults;
          } else {
            // Fallback: Just prepared food (any cuisine) but exclude ingredients/processes
            const generalPreparedResults = response.data.results.filter(photo => {
              const description = (photo.description || '').toLowerCase();
              const altDescription = (photo.alt_description || '').toLowerCase();
              const tags = photo.tags ? photo.tags.map(tag => tag.title.toLowerCase()).join(' ') : '';
              
              const combinedText = `${description} ${altDescription} ${tags}`;
              
              const preparedFoodKeywords = ['dish', 'meal', 'plate', 'bowl', 'served', 'cooked', 'prepared', 'ready', 'restaurant', 'food', 'drink', 'beverage', 'cup', 'glass'];
              const hasPreparedFood = preparedFoodKeywords.some(keyword => combinedText.includes(keyword));
              
              const excludeKeywords = ['grinding', 'powder', 'spice', 'ingredient', 'raw', 'uncooked', 'market', 'shop', 'selling', 'vendor', 'cooking process', 'preparation', 'making', 'recipe step', 'mortar', 'pestle', 'grinder'];
              const hasExcluded = excludeKeywords.some(keyword => combinedText.includes(keyword));
              
              return hasPreparedFood && !hasExcluded;
            });
            
            resultsToUse = generalPreparedResults.length > 0 ? generalPreparedResults : response.data.results.slice(0, 5);
          }
        }
        
        // Get a random result from the top results for variety
        // This ensures clicking "Auto-fetch" multiple times gives different images
        const randomIndex = Math.floor(Math.random() * Math.min(resultsToUse.length, 5));
        const photo = resultsToUse[randomIndex];
        const imageUrl = photo.urls.regular;

        console.log(`✅ Found Unsplash image for ${dishName} (selected ${randomIndex + 1} of ${resultsToUse.length}): ${imageUrl}`);

        // IMPORTANT: Trigger download endpoint (Unsplash API requirement)
        if (photo.links && photo.links.download_location) {
          this.triggerDownload(photo.links.download_location);
        }

        return imageUrl;
      }

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
  async getImageForDish(dishName, bypassCache = false) {
    // Check cache first (unless bypassing)
    if (!bypassCache && this.imageCache.has(dishName)) {
      console.log(`📋 Using cached image for: ${dishName}`);
      return this.imageCache.get(dishName);
    }

    if (bypassCache) {
      console.log(`🔄 Bypassing cache for: ${dishName} - fetching fresh image`);
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
  async autoFetchImageForMenuItem(dishName, bypassCache = false) {
    try {
      const imageUrl = await this.getImageForDish(dishName, bypassCache);
      return imageUrl;
    } catch (error) {
      console.error(`Auto-fetch image failed for ${dishName}:`, error.message);
      
      // Check for specific error types that should be propagated
      if (error.message.includes('API key') || 
          error.message.includes('rate limit') || 
          error.message.includes('not configured') ||
          error.message.includes('placeholder') ||
          error.message.includes('Invalid') ||
          error.message.includes('401') || 
          error.message.includes('429') ||
          error.message.includes('403')) {
        throw error; // Propagate configuration/rate limit errors
      }
      
      // For other errors (network issues, etc.), use fallback
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

  /**
   * Public method to test search query generation
   */
  testSearchQuery(dishName) {
    return this.getSearchQuery(dishName);
  }
}

module.exports = new ImageService();