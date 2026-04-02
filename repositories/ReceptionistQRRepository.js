const { dbRun, dbGet, dbAll } = require('../database-postgres');
const { generateId, generateQRUrl } = require('../utils/helpers');

class ReceptionistQRRepository {
  async create(qrData) {
    const id = generateId();
    const {
      tenant_id,
      name,
      identifier,
      is_active = 1
    } = qrData;

    const qr_url = generateQRUrl(null, identifier, 'receptionist');

    await dbRun(
      `INSERT INTO receptionist_qr (id, tenant_id, name, identifier, qr_url, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, tenant_id, name, identifier, qr_url, is_active]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM receptionist_qr WHERE id = $1', [id]);
  }

  async findByIdentifier(tenantId, identifier) {
    return dbGet(
      'SELECT * FROM receptionist_qr WHERE tenant_id = $1 AND identifier = $2',
      [tenantId, identifier]
    );
  }

  async findByTenant(tenantId) {
    return dbAll(
      'SELECT * FROM receptionist_qr WHERE tenant_id = $1 ORDER BY created_at DESC',
      [tenantId]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map((key, index) => `"${key}" = $${index + 1}`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE receptionist_qr SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length + 1}`,
      [...values, id]
    );
  }

  async deleteById(id) {
    await dbRun('DELETE FROM receptionist_qr WHERE id = ?', [id]);
  }
}

module.exports = new ReceptionistQRRepository();
