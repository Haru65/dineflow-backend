const { dbRun, dbGet, dbAll } = require('../database-postgres');
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
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, tenant_id, email, password_hash, name, role, is_active]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM users WHERE id = $1', [id]);
  }

  async findByEmail(email) {
    return dbGet('SELECT * FROM users WHERE email = $1', [email]);
  }

  async findByTenant(tenantId) {
    return dbAll('SELECT * FROM users WHERE tenant_id = $1 AND is_active = 1', [tenantId]);
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates);
    const placeholders = fields
      .map((_, index) => `"${fields[index]}" = $${index + 1}`)
      .join(', ');
    const values = Object.values(updates);
    const placeholderCount = values.length;

    await dbRun(
      `UPDATE users SET ${placeholders}, updated_at = CURRENT_TIMESTAMP WHERE id = $${placeholderCount + 1}`,
      [...values, id]
    );
  }

  async deactivate(id) {
    await this.updateById(id, { is_active: 0 });
  }
}

module.exports = new UserRepository();
