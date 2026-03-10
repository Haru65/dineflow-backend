const { dbRun, dbGet, dbAll } = require('../database-postgres');
const { generateId } = require('../utils/helpers');

class EmailConfigRepository {
  async create({ tenant_id, email_address, app_password }) {
    const id = generateId();
    await dbRun(
      `INSERT INTO email_configs (id, tenant_id, email_address, app_password)
       VALUES ($1, $2, $3, $4)`,
      [id, tenant_id, email_address, app_password]
    );
    return id;
  }

  async findByTenant(tenant_id) {
    return dbGet('SELECT * FROM email_configs WHERE tenant_id = $1', [tenant_id]);
  }

  async findById(id) {
    return dbGet('SELECT * FROM email_configs WHERE id = $1', [id]);
  }

  async updateById(id, updates) {
    const fields = [];
    const values = [];
    
    if (updates.email_address) {
      fields.push('email_address = $1');
      values.push(updates.email_address);
    }
    if (updates.app_password) {
      fields.push('app_password = $1');
      values.push(updates.app_password);
    }
    if (updates.is_active !== undefined) {
      fields.push('is_active = $1');
      values.push(updates.is_active);
    }

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    const sql = `UPDATE email_configs SET ${fields.join(', ')} WHERE id = $1`;
    await dbRun(sql, values);
  }

  async deleteById(id) {
    await dbRun('DELETE FROM email_configs WHERE id = $1', [id]);
  }

  async deleteByTenant(tenant_id) {
    await dbRun('DELETE FROM email_configs WHERE tenant_id = $1', [tenant_id]);
  }
}

module.exports = new EmailConfigRepository();
