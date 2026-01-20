const { dbRun, dbGet, dbAll } = require('../database');
const { generateId } = require('../utils/helpers');

class UserRepository {
  async create(userData) {
    const id = generateId();
    const {
      tenant_id,
      email,
      password_hash,
      name,
      role,
      is_active = 1
    } = userData;

    await dbRun(
      `INSERT INTO users (id, tenant_id, email, password_hash, name, role, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenant_id, email, password_hash, name, role, is_active]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM users WHERE id = ?', [id]);
  }

  async findByEmail(email) {
    return dbGet('SELECT * FROM users WHERE email = ? AND is_active = 1', [email]);
  }

  async findByTenant(tenantId) {
    return dbAll('SELECT * FROM users WHERE tenant_id = ? AND is_active = 1', [tenantId]);
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE users SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );
  }

  async deactivate(id) {
    await this.updateById(id, { is_active: 0 });
  }
}

module.exports = new UserRepository();
