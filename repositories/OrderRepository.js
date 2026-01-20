const { dbRun, dbGet, dbAll } = require('../database');
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, tenant_id, table_id, source_type, source_reference, status,
        payment_status, payment_provider, total_amount, tax_amount, discount_amount, notes
      ]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM orders WHERE id = ?', [id]);
  }

  async findByTenant(tenantId, filters = {}) {
    let query = 'SELECT * FROM orders WHERE tenant_id = ?';
    const params = [tenantId];

    if (filters.status) {
      query += ' AND status = ?';
      params.push(filters.status);
    }
    if (filters.source_type) {
      query += ' AND source_type = ?';
      params.push(filters.source_type);
    }
    if (filters.payment_status) {
      query += ' AND payment_status = ?';
      params.push(filters.payment_status);
    }

    query += ' ORDER BY created_at DESC';
    return dbAll(query, params);
  }

  async findByTable(tableId) {
    return dbAll(
      'SELECT * FROM orders WHERE table_id = ? ORDER BY created_at DESC',
      [tableId]
    );
  }

  async findByPaymentOrderId(paymentOrderId) {
    return dbGet(
      'SELECT * FROM orders WHERE payment_order_id = ?',
      [paymentOrderId]
    );
  }

  async updateById(id, updates) {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = Object.values(updates);

    await dbRun(
      `UPDATE orders SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
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
