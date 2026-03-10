const { dbRun, dbGet, dbAll } = require('../database-postgres');
const { generateId } = require('../utils/helpers');

class OffersRepository {
  async create(offerData) {
    const id = generateId();
    const {
      tenant_id,
      title,
      description,
      discount_percentage,
      discount_amount,
      valid_from,
      valid_until,
      is_active = 1
    } = offerData;

    await dbRun(
      `INSERT INTO offers (id, tenant_id, title, description, discount_percentage, discount_amount, valid_from, valid_until, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [id, tenant_id, title, description, discount_percentage, discount_amount, valid_from, valid_until, is_active]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM offers WHERE id = $1', [id]);
  }

  async findByTenant(tenantId) {
    return dbAll(
      `SELECT * FROM offers WHERE tenant_id = $1 ORDER BY created_at DESC`,
      [tenantId]
    );
  }

  async findActiveByTenant(tenantId) {
    return dbAll(
      `SELECT * FROM offers 
       WHERE tenant_id = $2 AND is_active = 1 
       AND (valid_from IS NULL OR valid_from <= CURRENT_TIMESTAMP)
       AND (valid_until IS NULL OR valid_until >= CURRENT_TIMESTAMP)
       ORDER BY created_at DESC`,
      [tenantId]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = $3`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE offers SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [...values, id]
    );
  }

  async deleteById(id) {
    await dbRun('DELETE FROM offers WHERE id = ?', [id]);
  }
}

module.exports = new OffersRepository();
