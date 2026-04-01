/**
 * geminiMenuExtractor.js
 * Service for extracting menu items from images using Google Gemini 2.5 Flash Vision API
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiMenuExtractor {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = 'gemini-2.5-flash'; // Use Gemini 2.5 Flash model
    this.genAI = null;
    
    if (this.apiKey && this.apiKey !== 'your_gemini_api_key_here') {
      this.genAI = new GoogleGenerativeAI(this.apiKey);
    }
  }

  /**
   * Extract menu items from image using Gemini Vision API
   */
  async extractMenuFromImage(imageBuffer, mimeType = 'image/jpeg') {
    if (!this.apiKey || this.apiKey === 'your_gemini_api_key_here') {
      throw new Error('GEMINI_API_KEY not configured in environment variables. Please set GEMINI_API_KEY in your .env file.');
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image buffer is empty');
    }

    try {
      const model = this.genAI.getGenerativeModel({ model: this.model });

      const prompt = `You are a menu extraction expert. Analyze this menu image and extract ALL menu items with their details.

Return ONLY a valid JSON array with this exact structure (no markdown, no explanation):
[
  {
    "name": "Item Name",
    "price": 99.99,
    "category": "Category Name",
    "description": "Brief description if visible"
  }
]

Rules:
- Extract ALL visible items from the menu
- Price must be a number (no currency symbols)
- Category should be one of: Starters, Mains, Breads, Rice, Biryani, Beverages, Desserts, Snacks, Extras, or Other
- If category is unclear, infer from item name (e.g., "Coffee" → "Beverages", "Paneer Tikka" → "Starters")
- Description is optional, only include if visible on menu
- Clean up OCR errors in item names
- Remove duplicate items
- Return ONLY the JSON array, nothing else`;

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: mimeType
        }
      };

      console.log(`Sending image to Gemini ${this.model}...`);
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No response from Gemini API');
      }

      console.log('Gemini response received, parsing...');

      // Parse the JSON response
      let menuItems;
      try {
        // Gemini may return JSON wrapped in markdown code blocks, clean it
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/```\n?/g, '');
        }
        
        const parsed = JSON.parse(cleanContent);
        // Handle both direct array and object with items property
        menuItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.menu_items || []);
      } catch (parseError) {
        console.error('Failed to parse Gemini response:', content);
        throw new Error('Invalid JSON response from Gemini API');
      }

      // Validate and clean the extracted items
      const validatedItems = this.validateAndCleanItems(menuItems);

      return {
        success: true,
        items: validatedItems,
        totalItems: validatedItems.length,
        rawResponse: content,
        model: this.model
      };

    } catch (error) {
      console.error('Gemini API error:', {
        message: error.message,
        code: error.code,
        status: error.status
      });
      
      if (error.message?.includes('API_KEY_INVALID') || error.message?.includes('invalid API key')) {
        throw new Error('Invalid Gemini API key - check GEMINI_API_KEY in environment');
      } else if (error.message?.includes('QUOTA_EXCEEDED') || error.message?.includes('quota')) {
        throw new Error('Gemini API quota exceeded. Please check your billing or try again later.');
      } else if (error.message?.includes('RATE_LIMIT_EXCEEDED')) {
        throw new Error('Gemini API rate limit exceeded. Please try again later.');
      } else if (error.message?.includes('SAFETY')) {
        throw new Error('Image was blocked by Gemini safety filters. Try a different image.');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Request timeout. Image may be too large.');
      }
      
      throw new Error(error.message || 'Failed to extract menu from image');
    }
  }

  /**
   * Validate and clean extracted menu items
   */
  validateAndCleanItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }

    const validItems = [];
    const seenItems = new Set();

    for (const item of items) {
      // Validate required fields
      if (!item.name || typeof item.name !== 'string') continue;
      if (item.price === undefined || item.price === null) continue;

      // Clean and normalize
      const cleanedItem = {
        name: this.cleanItemName(item.name),
        price: this.parsePrice(item.price),
        category: this.normalizeCategory(item.category || 'Other'),
        description: item.description ? String(item.description).trim().substring(0, 200) : ''
      };

      // Validate cleaned values
      if (!cleanedItem.name || cleanedItem.name.length < 2) continue;
      if (isNaN(cleanedItem.price) || cleanedItem.price <= 0 || cleanedItem.price > 100000) continue;

      // Remove duplicates (case-insensitive)
      const itemKey = `${cleanedItem.name.toLowerCase()}_${cleanedItem.price}`;
      if (seenItems.has(itemKey)) continue;
      seenItems.add(itemKey);

      validItems.push(cleanedItem);
    }

    return validItems;
  }

  /**
   * Clean item name
   */
  cleanItemName(name) {
    return name
      .trim()
      .replace(/\s+/g, ' ') // Multiple spaces to single
      .replace(/[^\w\s\-()&.,]/g, '') // Remove special chars except common ones
      .substring(0, 100); // Max length
  }

  /**
   * Parse price to number
   */
  parsePrice(price) {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      // Remove currency symbols and parse
      const cleaned = price.replace(/[₹$,\s]/g, '');
      return parseFloat(cleaned);
    }
    return 0;
  }

  /**
   * Normalize category name
   */
  normalizeCategory(category) {
    const categoryMap = {
      'appetizers': 'Starters',
      'starters': 'Starters',
      'starter': 'Starters',
      'main course': 'Mains',
      'mains': 'Mains',
      'main': 'Mains',
      'curry': 'Mains',
      'curries': 'Mains',
      'bread': 'Breads',
      'breads': 'Breads',
      'roti': 'Breads',
      'naan': 'Breads',
      'rice': 'Rice',
      'biryani': 'Biryani',
      'biryanis': 'Biryani',
      'beverages': 'Beverages',
      'beverage': 'Beverages',
      'drinks': 'Beverages',
      'drink': 'Beverages',
      'coffee': 'Beverages',
      'tea': 'Beverages',
      'desserts': 'Desserts',
      'dessert': 'Desserts',
      'sweets': 'Desserts',
      'sweet': 'Desserts',
      'snacks': 'Snacks',
      'snack': 'Snacks',
      'extras': 'Extras',
      'extra': 'Extras',
      'sides': 'Extras',
      'side': 'Extras'
    };

    const normalized = category.toLowerCase().trim();
    return categoryMap[normalized] || category.charAt(0).toUpperCase() + category.slice(1);
  }

  /**
   * Group items by category
   */
  groupByCategory(items) {
    return items.reduce((acc, item) => {
      const category = item.category || 'Other';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(item);
      return acc;
    }, {});
  }

  /**
   * Get extraction statistics
   */
  getStats(items) {
    if (items.length === 0) {
      return { total: 0, categories: 0, avgPrice: 0, minPrice: 0, maxPrice: 0 };
    }

    const prices = items.map(i => i.price);
    const categories = new Set(items.map(i => i.category));

    return {
      total: items.length,
      categories: categories.size,
      avgPrice: Math.round((prices.reduce((a, b) => a + b, 0) / prices.length) * 100) / 100,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices)
    };
  }
}

module.exports = new GeminiMenuExtractor();