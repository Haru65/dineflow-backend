const { dbRun, dbGet, dbAll } = require('../database-postgres');
const { generateId } = require('../utils/helpers');
const imageService = require('../utils/imageService');

class MenuItemRepository {
  async create(itemData) {
    const id = generateId();
    let {
      tenant_id,
      category_id,
      name,
      description,
      price,
      is_available = 1,
      image_url = null,
      is_veg = 1,
      is_spicy = 0,
      tags = '',
      preparation_time = null
    } = itemData;

    // Auto-fetch image if not provided
    if (!image_url && name) {
      try {
        console.log(`🖼️ Auto-fetching image for new menu item: ${name}`);
        image_url = await imageService.autoFetchImageForMenuItem(name);
        console.log(`✅ Auto-assigned image: ${image_url}`);
      } catch (error) {
        console.error(`⚠️ Failed to auto-fetch image for ${name}:`, error.message);
        // Continue without image - don't fail the creation
      }
    }

    console.log('Creating menu item with data:', {
      id,
      tenant_id,
      category_id,
      name,
      description,
      price,
      is_available,
      image_url,
      is_veg,
      is_spicy,
      tags,
      preparation_time
    });

    try {
      await dbRun(
        `INSERT INTO menu_items (id, tenant_id, category_id, name, description, price, is_available, image_url, is_veg, is_spicy, tags, preparation_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [id, tenant_id, category_id, name, description, parseFloat(price), is_available, image_url, is_veg, is_spicy, tags, preparation_time]
      );
      console.log('Menu item created successfully with id:', id);
      return id;
    } catch (error) {
      console.error('Error creating menu item:', error);
      throw error;
    }
  }

  async findById(id) {
    return dbGet('SELECT * FROM menu_items WHERE id = $1', [id]);
  }

  async findByCategory(categoryId) {
    return dbAll(
      'SELECT * FROM menu_items WHERE category_id = $1 AND is_available = 1',
      [categoryId]
    );
  }

  async findByTenant(tenantId) {
    return dbAll(
      `SELECT mi.* FROM menu_items mi
       WHERE mi.tenant_id = $1 AND mi.is_available = 1`,
      [tenantId]
    );
  }

  async findByCategoryAndTenant(tenantId, categoryId) {
    return dbAll(
      `SELECT * FROM menu_items 
       WHERE tenant_id = $1 AND category_id = $2 AND is_available = 1`,
      [tenantId, categoryId]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = $1`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE menu_items SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [...values, id]
    );
  }

  async deactivate(id) {
    await this.updateById(id, { is_available: 0 });
  }

  /**
   * Auto-fetch and update image for existing menu item
   */
  async autoUpdateImage(id) {
    try {
      const item = await this.findById(id);
      if (!item) {
        throw new Error('Menu item not found');
      }

      if (item.image_url) {
        console.log(`Item ${item.name} already has image: ${item.image_url}`);
        return item.image_url;
      }

      console.log(`🖼️ Auto-fetching image for existing item: ${item.name}`);
      const imageUrl = await imageService.autoFetchImageForMenuItem(item.name);
      
      if (imageUrl) {
        await this.updateById(id, { image_url: imageUrl });
        console.log(`✅ Updated ${item.name} with image: ${imageUrl}`);
        return imageUrl;
      }

      return null;
    } catch (error) {
      console.error(`Error auto-updating image for item ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Bulk update images for items without images
   */
  async bulkUpdateMissingImages(tenantId = null) {
    try {
      let query = 'SELECT id, name FROM menu_items WHERE is_available = 1 AND (image_url IS NULL OR image_url = \'\')';
      let params = [];
      
      if (tenantId) {
        query += ' AND tenant_id = $1';
        params = [tenantId];
      }

      const itemsWithoutImages = await dbAll(query, params);
      
      console.log(`Found ${itemsWithoutImages.length} items without images`);
      
      const results = [];
      for (const item of itemsWithoutImages) {
        try {
          const imageUrl = await this.autoUpdateImage(item.id);
          results.push({ id: item.id, name: item.name, imageUrl, success: true });
          
          // Small delay to be respectful to APIs
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Failed to update image for ${item.name}:`, error.message);
          results.push({ id: item.id, name: item.name, error: error.message, success: false });
        }
      }

      return results;
    } catch (error) {
      console.error('Error in bulkUpdateMissingImages:', error);
      throw error;
    }
  }
}

module.exports = new MenuItemRepository();
