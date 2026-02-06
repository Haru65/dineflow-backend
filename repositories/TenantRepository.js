const { dbRun, dbGet, dbAll } = require('../database');
const { generateId, generateSlug } = require('../utils/helpers');

class TenantRepository {
  async create(tenantData) {
    const id = generateId();
    const { name, address, contact_phone } = tenantData;
    const slug = generateSlug(name);

    await dbRun(
      `INSERT INTO tenants (id, name, slug, address, contact_phone)
       VALUES (?, ?, ?, ?, ?)`,
      [id, name, slug, address, contact_phone]
    );
    return { id, slug };
  }

  async findById(id) {
    return dbGet('SELECT * FROM tenants WHERE id = ? AND is_active = 1', [id]);
  }

  async findBySlug(slug) {
    return dbGet('SELECT * FROM tenants WHERE slug = ? AND is_active = 1', [slug]);
  }

  async findAll() {
    return dbAll('SELECT * FROM tenants WHERE is_active = 1 ORDER BY created_at DESC');
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE tenants SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );
  }

  async deleteById(id) {
    // Soft delete - set is_active to 0 instead of hard delete
    await dbRun('UPDATE tenants SET is_active = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [id]);
  }

  async hardDeleteById(id) {
    // Hard delete - only use in extreme cases
    await dbRun('DELETE FROM tenants WHERE id = ?', [id]);
  }
}

module.exports = new TenantRepository();
