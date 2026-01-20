const { dbRun, dbGet, dbAll } = require('../database');
const { generateId } = require('../utils/helpers');

class MenuItemRepository {
  async create(itemData) {
    const id = generateId();
    const {
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
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    return dbGet('SELECT * FROM menu_items WHERE id = ?', [id]);
  }

  async findByCategory(categoryId) {
    return dbAll(
      'SELECT * FROM menu_items WHERE category_id = ? AND is_available = 1',
      [categoryId]
    );
  }

  async findByTenant(tenantId) {
    return dbAll(
      `SELECT mi.* FROM menu_items mi
       WHERE mi.tenant_id = ? AND mi.is_available = 1`,
      [tenantId]
    );
  }

  async findByCategoryAndTenant(tenantId, categoryId) {
    return dbAll(
      `SELECT * FROM menu_items 
       WHERE tenant_id = ? AND category_id = ? AND is_available = 1`,
      [tenantId, categoryId]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE menu_items SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );
  }

  async deactivate(id) {
    await this.updateById(id, { is_available: 0 });
  }
}

module.exports = new MenuItemRepository();
