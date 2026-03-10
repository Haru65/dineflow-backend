const { dbRun, dbGet, dbAll } = require('../database-postgres');
const { generateId } = require('../utils/helpers');

class MenuCategoryRepository {
  async create(categoryData) {
    const id = generateId();
    const { tenant_id, name, sort_order = 0 } = categoryData;

    await dbRun(
      `INSERT INTO menu_categories (id, tenant_id, name, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [id, tenant_id, name, sort_order]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM menu_categories WHERE id = $1', [id]);
  }

  async findByTenant(tenantId) {
    return dbAll(
      'SELECT * FROM menu_categories WHERE tenant_id = $1 AND is_active = 1 ORDER BY sort_order, name',
      [tenantId]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = $1`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE menu_categories SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [...values, id]
    );
  }

  async deactivate(id) {
    await this.updateById(id, { is_active: 0 });
  }
}

module.exports = new MenuCategoryRepository();
