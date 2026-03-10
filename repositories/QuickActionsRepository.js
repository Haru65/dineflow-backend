const { dbRun, dbGet, dbAll } = require('../database-postgres');
const { generateId } = require('../utils/helpers');

class QuickActionsRepository {
  async create(actionData) {
    const id = generateId();
    const {
      tenant_id,
      name,
      icon,
      price,
      is_active = 1,
      sort_order = 0
    } = actionData;

    await dbRun(
      `INSERT INTO quick_actions (id, tenant_id, name, icon, price, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenant_id, name, icon, price, is_active, sort_order]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM quick_actions WHERE id = ?', [id]);
  }

  async findByTenant(tenantId) {
    return dbAll(
      'SELECT * FROM quick_actions WHERE tenant_id = ? AND is_active = 1 ORDER BY sort_order ASC',
      [tenantId]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE quick_actions SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );
  }

  async deleteById(id) {
    await dbRun('DELETE FROM quick_actions WHERE id = ?', [id]);
  }
}

module.exports = new QuickActionsRepository();
