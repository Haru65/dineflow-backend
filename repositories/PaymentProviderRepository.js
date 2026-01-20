const { dbRun, dbGet } = require('../database');
const { generateId } = require('../utils/helpers');

class PaymentProviderRepository {
  async create(providerData) {
    const id = generateId();
    const {
      tenant_id,
      provider,
      key_id,
      key_secret,
      webhook_secret,
      is_active = 1
    } = providerData;

    await dbRun(
      `INSERT INTO payment_providers (id, tenant_id, provider, key_id, key_secret, webhook_secret, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, tenant_id, provider, key_id, key_secret, webhook_secret, is_active]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM payment_providers WHERE id = ?', [id]);
  }

  async findByTenant(tenantId, provider = 'razorpay') {
    return dbGet(
      'SELECT * FROM payment_providers WHERE tenant_id = ? AND provider = ? AND is_active = 1',
      [tenantId, provider]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE payment_providers SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [...values, id]
    );
  }
}

module.exports = new PaymentProviderRepository();
