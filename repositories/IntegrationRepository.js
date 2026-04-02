const { dbRun, dbGet } = require('../database-postgres');
const { generateId } = require('../utils/helpers');

class IntegrationRepository {
  async create(integrationData) {
    const id = generateId();
    const {
      tenant_id,
      provider, // 'zomato' or 'swiggy'
      webhook_url,
      soapie_url,
      api_key,
      is_active = 1
    } = integrationData;

    await dbRun(
      `INSERT INTO integrations (id, tenant_id, provider, webhook_url, soapie_url, api_key, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, tenant_id, provider, webhook_url, soapie_url, api_key, is_active]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM integrations WHERE id = $1', [id]);
  }

  async findByTenant(tenantId, provider = null) {
    if (provider) {
      return dbGet(
        'SELECT * FROM integrations WHERE tenant_id = $1 AND provider = $2',
        [tenantId, provider]
      );
    }
    return dbGet(
      'SELECT * FROM integrations WHERE tenant_id = $1',
      [tenantId]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map((key, index) => `"${key}" = $${index + 1}`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE integrations SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $${values.length + 1}`,
      [...values, id]
    );
  }

  async deleteById(id) {
    await dbRun('DELETE FROM integrations WHERE id = ?', [id]);
  }
}

module.exports = new IntegrationRepository();
