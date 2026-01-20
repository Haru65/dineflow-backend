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
    return dbGet('SELECT * FROM tenants WHERE id = ?', [id]);
  }

  async findBySlug(slug) {
    return dbGet('SELECT * FROM tenants WHERE slug = ?', [slug]);
  }

  async findAll() {
    return dbAll('SELECT * FROM tenants ORDER BY created_at DESC');
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
    await dbRun('DELETE FROM tenants WHERE id = ?', [id]);
  }
}

module.exports = new TenantRepository();
