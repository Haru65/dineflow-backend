/**
 * openaiMenuExtractor.js
 * Service for extracting menu items from images using OpenAI GPT-4 Vision API
 */

const axios = require('axios');

class OpenAIMenuExtractor {
  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.apiUrl = 'https://api.openai.com/v1/chat/completions';
    this.model = 'gpt-4o'; // GPT-4 Omni supports vision
  }

  /**
   * Convert image file to base64
   */
  async imageToBase64(imageBuffer) {
    return imageBuffer.toString('base64');
  }

  /**
   * Extract menu items from image using OpenAI GPT-4 Vision API
   */
  async extractMenuFromImage(imageBuffer, mimeType = 'image/jpeg') {
    if (!this.apiKey || this.apiKey === 'your_openai_api_key_here') {
      throw new Error('OPENAI_API_KEY not configured in environment variables. Please set OPENAI_API_KEY in your .env file.');
    }

    if (!imageBuffer || imageBuffer.length === 0) {
      throw new Error('Image buffer is empty');
    }

    try {
      const base64Image = await this.imageToBase64(imageBuffer);
      
      const response = await axios.post(
        this.apiUrl,
        {
          model: this.model,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `You are a menu extraction expert. Analyze this menu image and extract ALL menu items with their details.

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
- Return ONLY the JSON array, nothing else`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${mimeType};base64,${base64Image}`,
                    detail: "high"
                  }
                }
              ]
            }
          ],
          max_tokens: 4096,
          temperature: 0.1
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 60000
        }
      );

      const content = response.data.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI API');
      }

      // Parse the JSON response
      let menuItems;
      try {
        let cleanContent = content.trim();
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/```json\n?/g, '').replace(/```\n?/g, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/```\n?/g, '');
        }
        
        const parsed = JSON.parse(cleanContent);
        menuItems = Array.isArray(parsed) ? parsed : (parsed.items || parsed.menu_items || []);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', content);
        throw new Error('Invalid JSON response from OpenAI API');
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
      console.error('OpenAI API error:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        code: error.code
      });
      
      if (error.response?.status === 401) {
        throw new Error('Invalid OpenAI API key - check OPENAI_API_KEY in environment');
      } else if (error.response?.status === 400) {
        const errorMsg = error.response?.data?.error?.message || 'Bad request to OpenAI API';
        throw new Error(`OpenAI API error: ${errorMsg}`);
      } else if (error.response?.status === 429) {
        throw new Error('OpenAI API rate limit exceeded. Please try again later.');
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
      if (!item.name || typeof item.name !== 'string') continue;
      if (item.price === undefined || item.price === null) continue;

      const cleanedItem = {
        name: this.cleanItemName(item.name),
        price: this.parsePrice(item.price),
        category: this.normalizeCategory(item.category || 'Other'),
        description: item.description ? String(item.description).trim().substring(0, 200) : ''
      };

      if (!cleanedItem.name || cleanedItem.name.length < 2) continue;
      if (isNaN(cleanedItem.price) || cleanedItem.price <= 0 || cleanedItem.price > 100000) continue;

      const itemKey = `${cleanedItem.name.toLowerCase()}_${cleanedItem.price}`;
      if (seenItems.has(itemKey)) continue;
      seenItems.add(itemKey);

      validItems.push(cleanedItem);
    }

    return validItems;
  }

  cleanItemName(name) {
    return name
      .trim()
      .replace(/\s+/g, ' ')
      .replace(/[^\w\s\-()&.,]/g, '')
      .substring(0, 100);
  }

  parsePrice(price) {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
      const cleaned = price.replace(/[₹$,\s]/g, '');
      return parseFloat(cleaned);
    }
    return 0;
  }

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

module.exports = new OpenAIMenuExtractor();