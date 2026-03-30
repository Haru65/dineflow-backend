/**
 * groqMenuExtractor.js
 * Service for extracting menu items from images using Groq Vision API
 */

const axios = require('axios');

class GroqMenuExtractor {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY;
    this.apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
    this.model = 'llama-3.2-90b-vision-preview'; // Groq's vision model
  }

  /**
   * Convert image file to base64
   */
  async imageToBase64(imageBuffer) {
    return imageBuffer.toString('base64');
  }

  /**
   * Extract menu items from image using Groq Vision API
   */
  async extractMenuFromImage(imageBuffer, mimeType = 'image/jpeg') {
    if (!this.apiKey) {
      throw new Error('GROQ_API_KEY not configured in environment variables');
    }

    try {
      const base64Image = await this.imageToBase64(imageBuffer);
      
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

      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: prompt
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`
                  }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 4096,
          response_format: { type: 'json_object' }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000 // 60 second timeout
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from Groq API');
      }

      // Parse the JSON response
      let menuItems;
      try {
        const parsed = JSON.parse(content);
        // Handle both direct array and object with items property
        menuItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.menu_items || []);
      } catch (parseError) {
        console.error('Failed to parse Groq response:', content);
        throw new Error('Invalid JSON response from Groq API');
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
      console.error('Groq API error:', error.response?.data || error.message);
      
      if (error.response?.status === 401) {
        throw new Error('Invalid Groq API key');
      } else if (error.response?.status === 429) {
        throw new Error('Groq API rate limit exceeded. Please try again later.');
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

module.exports = new GroqMenuExtractor();
