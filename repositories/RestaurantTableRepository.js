const { dbRun, dbGet, dbAll } = require('../database-postgres');
const { generateId } = require('../utils/helpers');

class RestaurantTableRepository {
  async create(tableData) {
    const id = generateId();
    const { tenant_id, name, identifier, qr_url, is_active = 1, table_type = 'regular' } = tableData;

    await dbRun(
      `INSERT INTO restaurant_tables (id, tenant_id, name, identifier, qr_url, is_active, table_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, tenant_id, name, identifier, qr_url, is_active, table_type]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM restaurant_tables WHERE id = $1', [id]);
  }

  async findByIdentifier(tenantId, identifier) {
    return dbGet(
      'SELECT * FROM restaurant_tables WHERE tenant_id = $1 AND identifier = $2',
      [tenantId, identifier]
    );
  }

  async findByTenant(tenantId) {
    return dbAll(
      'SELECT * FROM restaurant_tables WHERE tenant_id = $1 AND is_active = 1 ORDER BY name',
      [tenantId]
    );
  }

  async findAll() {
    return dbAll('SELECT * FROM restaurant_tables WHERE is_active = 1');
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = $1`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE restaurant_tables SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [...values, id]
    );
  }

  async deactivate(id) {
    await this.updateById(id, { is_active: 0 });
  }

  async createBulk(tablesData) {
    // tablesData: Array of { tenant_id, name, identifier, qr_url, table_type }
    const createdTables = [];
    
    for (const tableData of tablesData) {
      const id = generateId();
      const { tenant_id, name, identifier, qr_url, is_active = 1, table_type = 'regular' } = tableData;

      await dbRun(
        `INSERT INTO restaurant_tables (id, tenant_id, name, identifier, qr_url, is_active, table_type)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [id, tenant_id, name, identifier, qr_url, is_active, table_type]
      );
      
      createdTables.push({
        id,
        tenant_id,
        name,
        identifier,
        qr_url,
        is_active,
        table_type
      });
    }

    return createdTables;
  }
}

module.exports = new RestaurantTableRepository();
