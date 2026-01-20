const { dbRun, dbGet, dbAll } = require('../database');
const { generateId } = require('../utils/helpers');

class RestaurantTableRepository {
  async create(tableData) {
    const id = generateId();
    const { tenant_id, name, identifier, qr_url, is_active = 1 } = tableData;

    await dbRun(
      `INSERT INTO restaurant_tables (id, tenant_id, name, identifier, qr_url, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tenant_id, name, identifier, qr_url, is_active]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM restaurant_tables WHERE id = ?', [id]);
  }

  async findByIdentifier(tenantId, identifier) {
    return dbGet(
      'SELECT * FROM restaurant_tables WHERE tenant_id = ? AND identifier = ?',
      [tenantId, identifier]
    );
  }

  async findByTenant(tenantId) {
    return dbAll(
      'SELECT * FROM restaurant_tables WHERE tenant_id = ? AND is_active = 1 ORDER BY name',
      [tenantId]
    );
  }

  async findAll() {
    return dbAll('SELECT * FROM restaurant_tables WHERE is_active = 1');
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE restaurant_tables SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );
  }

  async deactivate(id) {
    await this.updateById(id, { is_active: 0 });
  }
}

module.exports = new RestaurantTableRepository();
