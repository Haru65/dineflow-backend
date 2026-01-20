const MenuCategoryRepository = require('../repositories/MenuCategoryRepository');

const DEFAULT_CATEGORIES = [
  { name: 'Starters', sort_order: 0 },
  { name: 'Main Course', sort_order: 1 },
  { name: 'Desserts', sort_order: 2 },
  { name: 'Drinks', sort_order: 3 }
];

/**
 * Create default menu categories for a new tenant
 * @param {string} tenantId - The tenant ID
 * @returns {Promise<Array>} Array of created category IDs
 */
async function createDefaultCategories(tenantId) {
  try {
    const categoryIds = [];
    
    console.log(`Creating default categories for tenant: ${tenantId}`);
    
    for (const category of DEFAULT_CATEGORIES) {
      const categoryId = await MenuCategoryRepository.create({
        tenant_id: tenantId,
        name: category.name,
        sort_order: category.sort_order
      });
      categoryIds.push(categoryId);
      console.log(`Created category: ${category.name} (ID: ${categoryId})`);
    }
    
    console.log(`Successfully created ${categoryIds.length} default categories for tenant: ${tenantId}`);
    return categoryIds;
  } catch (error) {
    console.error('Error creating default categories:', error);
    throw error;
  }
}

module.exports = {
  createDefaultCategories,
  DEFAULT_CATEGORIES
};
