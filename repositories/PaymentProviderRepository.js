const { dbRun, dbGet } = require('../database-postgres');
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
      website,
      is_active = 1
    } = providerData;

    await dbRun(
      `INSERT INTO payment_providers (id, tenant_id, provider, key_id, key_secret, webhook_secret, website, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [id, tenant_id, provider, key_id, key_secret, webhook_secret, website, is_active]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM payment_providers WHERE id = $1', [id]);
  }

  async findByTenant(tenantId, provider = 'razorpay') {
    return dbGet(
      'SELECT * FROM payment_providers WHERE tenant_id = $1 AND provider = $2 AND is_active = 1',
      [tenantId, provider]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map((key, index) => `"${key}" = $${index + 1}`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE payment_providers SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length + 1}`,
      [...values, id]
    );
  }
}

module.exports = new PaymentProviderRepository();