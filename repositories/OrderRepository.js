const { dbRun, dbGet, dbAll } = require('../database-postgres');
const { generateId } = require('../utils/helpers');

class OrderRepository {
  async create(orderData) {
    const id = generateId();
    const {
      tenant_id,
      table_id,
      source_type,
      source_reference,
      status = 'pending',
      payment_status = 'pending',
      payment_provider = null,
      total_amount = 0,
      tax_amount = 0,
      discount_amount = 0,
      notes
    } = orderData;

    await dbRun(
      `INSERT INTO orders (
        id, tenant_id, table_id, source_type, source_reference, status, 
        payment_status, payment_provider, total_amount, tax_amount, discount_amount, notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id, tenant_id, table_id, source_type, source_reference, status,
        payment_status, payment_provider, total_amount, tax_amount, discount_amount, notes
      ]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM orders WHERE id = $1', [id]);
  }

  async findByTenant(tenantId, filters = {}) {
    let query = 'SELECT * FROM orders WHERE tenant_id = $1';
    const params = [tenantId];

    if (filters.status) {
      query += ' AND status = $1';
      params.push(filters.status);
    }
    if (filters.source_type) {
      query += ' AND source_type = $1';
      params.push(filters.source_type);
    }
    if (filters.payment_status) {
      query += ' AND payment_status = $1';
      params.push(filters.payment_status);
    }

    query += ' ORDER BY created_at DESC';
    return dbAll(query, params);
  }

  async findByTable(tableId) {
    return dbAll(
      'SELECT * FROM orders WHERE table_id = $1 ORDER BY created_at DESC',
      [tableId]
    );
  }

  async findByPaymentOrderId(paymentOrderId) {
    return dbGet(
      'SELECT * FROM orders WHERE payment_order_id = $1',
      [paymentOrderId]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = $1`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE orders SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [...values, id]
    );
  }

  async updatePaymentStatus(orderId, paymentStatus, paymentId = null, paymentOrderId = null) {
    const updates = { payment_status: paymentStatus };
    if (paymentId) updates.payment_id = paymentId;
    if (paymentOrderId) updates.payment_order_id = paymentOrderId;
    
    await this.updateById(orderId, updates);
  }
}

module.exports = new OrderRepository();
