/**
 * menuExtraction.js
 * Routes for menu extraction using Groq Vision API
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const { authenticateToken, authorizeRestaurantAdmin } = require('../utils/auth');
const { errorResponse, successResponse } = require('../utils/helpers');
const openaiMenuExtractor = require('../services/openaiMenuExtractor');
const MenuCategoryRepository = require('../repositories/MenuCategoryRepository');
const MenuItemRepository = require('../repositories/MenuItemRepository');

// Configure multer for image uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and PDF are allowed.'));
    }
  }
});

// Middleware to verify tenant access
const verifyTenantAccess = async (req, res, next) => {
  const tenantId = req.params.tenantId;
  
  if (req.user.role === 'superadmin') {
    next();
  } else if (req.user.role === 'restaurant_admin' && req.user.tenantId === tenantId) {
    next();
  } else {
    errorResponse(res, 403, 'Access denied');
  }
};

/**
 * POST /:tenantId/menu/extract-from-image
 * Extract menu items from uploaded image using Groq Vision API
 */
router.post(
  '/:tenantId/menu/extract-from-image',
  authenticateToken,
  authorizeRestaurantAdmin,
  verifyTenantAccess,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return errorResponse(res, 400, 'No image file uploaded');
      }

      console.log(`Extracting menu from image: ${req.file.originalname} (${req.file.size} bytes)`);

      // Extract menu items using OpenAI
      const result = await openaiMenuExtractor.extractMenuFromImage(
        req.file.buffer,
        req.file.mimetype
      );

      // Group items by category
      const itemsByCategory = openaiMenuExtractor.groupByCategory(result.items);
      const stats = openaiMenuExtractor.getStats(result.items);

      successResponse(res, 200, {
        success: true,
        items: result.items,
        totalItems: result.totalItems,
        itemsByCategory,
        stats,
        categories: Object.keys(itemsByCategory),
        model: result.model
      }, 'Menu extracted successfully');

    } catch (error) {
      console.error('Menu extraction error:', error);
      errorResponse(res, 500, error.message || 'Failed to extract menu from image');
    }
  }
);

/**
 * POST /:tenantId/menu/import-extracted
 * Import extracted menu items directly to database
 */
router.post(
  '/:tenantId/menu/import-extracted',
  authenticateToken,
  authorizeRestaurantAdmin,
  verifyTenantAccess,
  async (req, res) => {
    try {
      const { items, categoryMapping } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return errorResponse(res, 400, 'Items array is required and must not be empty');
      }

      // Get or create categories
      const existingCategories = await MenuCategoryRepository.findByTenant(req.params.tenantId);
      const categoryMap = {};

      // Build category name to ID map
      existingCategories.forEach(cat => {
        categoryMap[cat.name.toLowerCase()] = cat.id;
      });

      // Create missing categories
      const uniqueCategories = [...new Set(items.map(item => item.category))];
      for (const categoryName of uniqueCategories) {
        const normalizedName = categoryName.toLowerCase();
        if (!categoryMap[normalizedName]) {
          const categoryId = await MenuCategoryRepository.create({
            tenant_id: req.params.tenantId,
            name: categoryName,
            sort_order: Object.keys(categoryMap).length
          });
          categoryMap[normalizedName] = categoryId;
          console.log(`Created new category: ${categoryName} (${categoryId})`);
        }
      }

      // Import items
      const createdItems = [];
      const errors = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        try {
          // Validate item
          if (!item.name || !item.price || !item.category) {
            errors.push(`Item ${i + 1}: Missing required fields (name, price, category)`);
            continue;
          }

          // Get category ID (use mapping if provided, otherwise use extracted category)
          const categoryName = categoryMapping?.[item.name] || item.category;
          const categoryId = categoryMap[categoryName.toLowerCase()];

          if (!categoryId) {
            errors.push(`Item ${i + 1}: Category "${categoryName}" not found`);
            continue;
          }

          // Create menu item
          const itemId = await MenuItemRepository.create({
            tenant_id: req.params.tenantId,
            category_id: categoryId,
            name: item.name,
            description: item.description || '',
            price: parseFloat(item.price),
            image_url: null, // Will be auto-fetched later if needed
            is_veg: 1, // Default to veg, can be updated later
            is_spicy: 0,
            tags: '',
            preparation_time: null
          });

          const createdItem = await MenuItemRepository.findById(itemId);
          createdItems.push(createdItem);

        } catch (itemError) {
          console.error(`Error creating item ${i + 1}:`, itemError);
          errors.push(`Item ${i + 1} (${item.name}): ${itemError.message}`);
        }
      }

      // Return response
      if (createdItems.length === 0) {
        return errorResponse(res, 400, 'No items were imported', errors.join('; '));
      }

      successResponse(res, 201, {
        imported: createdItems.length,
        failed: errors.length,
        items: createdItems,
        errors: errors.length > 0 ? errors : undefined
      }, `Successfully imported ${createdItems.length} items${errors.length > 0 ? ` (${errors.length} failed)` : ''}`);

    } catch (error) {
      console.error('Import extracted menu error:', error);
      errorResponse(res, 500, 'Failed to import menu items', error.message);
    }
  }
);

/**
 * POST /:tenantId/menu/extract-and-import
 * One-step: Extract from image and import directly to database
 */
router.post(
  '/:tenantId/menu/extract-and-import',
  authenticateToken,
  authorizeRestaurantAdmin,
  verifyTenantAccess,
  upload.single('image'),
  async (req, res) => {
    try {
      if (!req.file) {
        return errorResponse(res, 400, 'No image file uploaded');
      }

      console.log(`Extracting and importing menu from: ${req.file.originalname}`);

      // Step 1: Extract menu items using OpenAI
      const extractionResult = await openaiMenuExtractor.extractMenuFromImage(
        req.file.buffer,
        req.file.mimetype
      );

      if (!extractionResult.success || extractionResult.items.length === 0) {
        return errorResponse(res, 400, 'No menu items could be extracted from the image');
      }

      console.log(`Extracted ${extractionResult.totalItems} items, importing to database...`);

      // Step 2: Get or create categories
      const existingCategories = await MenuCategoryRepository.findByTenant(req.params.tenantId);
      const categoryMap = {};

      existingCategories.forEach(cat => {
        categoryMap[cat.name.toLowerCase()] = cat.id;
      });

      const uniqueCategories = [...new Set(extractionResult.items.map(item => item.category))];
      for (const categoryName of uniqueCategories) {
        const normalizedName = categoryName.toLowerCase();
        if (!categoryMap[normalizedName]) {
          const categoryId = await MenuCategoryRepository.create({
            tenant_id: req.params.tenantId,
            name: categoryName,
            sort_order: Object.keys(categoryMap).length
          });
          categoryMap[normalizedName] = categoryId;
        }
      }

      // Step 3: Import items to database
      const createdItems = [];
      const errors = [];

      for (const item of extractionResult.items) {
        try {
          const categoryId = categoryMap[item.category.toLowerCase()];

          const itemId = await MenuItemRepository.create({
            tenant_id: req.params.tenantId,
            category_id: categoryId,
            name: item.name,
            description: item.description || '',
            price: item.price,
            image_url: null,
            is_veg: 1,
            is_spicy: 0,
            tags: '',
            preparation_time: null
          });

          const createdItem = await MenuItemRepository.findById(itemId);
          createdItems.push(createdItem);

        } catch (itemError) {
          errors.push(`${item.name}: ${itemError.message}`);
        }
      }

      // Return comprehensive response
      successResponse(res, 201, {
        extracted: extractionResult.totalItems,
        imported: createdItems.length,
        failed: errors.length,
        items: createdItems,
        itemsByCategory: openaiMenuExtractor.groupByCategory(createdItems),
        stats: openaiMenuExtractor.getStats(createdItems),
        errors: errors.length > 0 ? errors : undefined,
        model: extractionResult.model
      }, `Extracted ${extractionResult.totalItems} items and imported ${createdItems.length} to database`);

    } catch (error) {
      console.error('Extract and import error:', error);
      errorResponse(res, 500, error.message || 'Failed to extract and import menu');
    }
  }
);

module.exports = router;
