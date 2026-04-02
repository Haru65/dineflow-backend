const { dbRun, dbGet, dbAll } = require('../database-postgres');
const { generateId } = require('../utils/helpers');

class OrderItemRepository {
  async create(itemData) {
    const id = generateId();
    const {
      order_id,
      menu_item_id,
      name_snapshot,
      price_snapshot,
      quantity
    } = itemData;

    await dbRun(
      `INSERT INTO order_items (id, order_id, menu_item_id, name_snapshot, price_snapshot, quantity)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, order_id, menu_item_id, name_snapshot, price_snapshot, quantity]
    );
    return id;
  }

  async findById(id) {
    return dbGet('SELECT * FROM order_items WHERE id = $1', [id]);
  }

  async findByOrder(orderId) {
    return dbAll(
      `SELECT 
        oi.id, oi.order_id, oi.menu_item_id, oi.name_snapshot, 
        oi.price_snapshot, oi.quantity, oi.status, oi.notes,
        mi.is_veg, mi.is_spicy
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = $1`,
      [orderId]
    );
  }

  async deleteByOrder(orderId) {
    await dbRun('DELETE FROM order_items WHERE order_id = $1', [orderId]);
  }

  async updateById(id, updates) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    for (const [key, value] of Object.entries(updates)) {
      paramCount++;
      fields.push(`"${key}" = $${paramCount}`);
      values.push(value);
    }

    if (fields.length === 0) return;

    paramCount++;
    values.push(id);
    await dbRun(
      `UPDATE order_items SET ${fields.join(', ')} WHERE id = $${paramCount}`,
      values
    );
  }
}

module.exports = new OrderItemRepository();
