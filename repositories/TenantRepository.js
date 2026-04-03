const { dbRun, dbGet, dbAll } = require('../database-postgres');
const { generateId, generateSlug } = require('../utils/helpers');

class TenantRepository {
  async create(tenantData) {
    const id = generateId();
    const { name, address, contact_phone, logo_url } = tenantData;
    const slug = generateSlug(name);

    await dbRun(
      `INSERT INTO tenants (id, name, slug, address, contact_phone, logo_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, name, slug, address, contact_phone, logo_url || null]
    );
    return { id, slug };
  }

  async findById(id) {
    return dbGet('SELECT * FROM tenants WHERE id = $1', [id]);
  }

  async findBySlug(slug) {
    return dbGet('SELECT * FROM tenants WHERE slug = $1', [slug]);
  }

  async findAll() {
    return dbAll('SELECT * FROM tenants ORDER BY created_at DESC');
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map((key, index) => `"${key}" = $${index + 1}`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE tenants SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length + 1}`,
      [...values, id]
    );
  }

  async deleteById(id) {
    await dbRun('DELETE FROM tenants WHERE id = $1', [id]);
  }
}

module.exports = new TenantRepository();
