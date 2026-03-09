const { dbRun, dbGet, dbAll } = require('../database');
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
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, tenant_id, name, identifier, qr_url, is_active]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM receptionist_qr WHERE id = ?', [id]);
  }

  async findByIdentifier(tenantId, identifier) {
    return dbGet(
      'SELECT * FROM receptionist_qr WHERE tenant_id = ? AND identifier = ?',
      [tenantId, identifier]
    );
  }

  async findByTenant(tenantId) {
    return dbAll(
      'SELECT * FROM receptionist_qr WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE receptionist_qr SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );
  }

  async deleteById(id) {
    await dbRun('DELETE FROM receptionist_qr WHERE id = ?', [id]);
  }
}

module.exports = new ReceptionistQRRepository();
