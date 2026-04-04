const db = require('../database-postgres');

class ComboRepository {
  /**
   * Find all combos for a tenant
   */
  static async findByTenant(tenantId) {
    const query = `
      SELECT 
        co.*,
        json_agg(
          json_build_object(
            'id', ci.id,
            'menu_item_id', ci.menu_item_id,
            'quantity', ci.quantity,
            'item_name', mi.name,
            'item_price', mi.price,
            'item_image', mi.image_url
          ) ORDER BY ci.created_at
        ) FILTER (WHERE ci.id IS NOT NULL) as items
      FROM combo_offers co
      LEFT JOIN combo_items ci ON co.id = ci.combo_id
      LEFT JOIN menu_items mi ON ci.menu_item_id = mi.id
      WHERE co.tenant_id = $1
      GROUP BY co.id
      ORDER BY co.created_at DESC
    `;
    const result = await db.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Find active combos for customer view
   */
  static async findActiveByTenant(tenantId) {
    const query = `
      SELECT 
        co.*,
        json_agg(
          json_build_object(
            'id', ci.id,
            'menu_item_id', ci.menu_item_id,
            'quantity', ci.quantity,
            'item_name', mi.name,
            'item_price', mi.price,
            'item_image', mi.image_url
          ) ORDER BY ci.created_at
        ) FILTER (WHERE ci.id IS NOT NULL) as items
      FROM combo_offers co
      LEFT JOIN combo_items ci ON co.id = ci.combo_id
      LEFT JOIN menu_items mi ON ci.menu_item_id = mi.id
      WHERE co.tenant_id = $1
        AND co.is_active = true
        AND (co.valid_from IS NULL OR co.valid_from <= CURRENT_TIMESTAMP)
        AND (co.valid_until IS NULL OR co.valid_until >= CURRENT_TIMESTAMP)
      GROUP BY co.id
      ORDER BY co.created_at DESC
    `;
    const result = await db.query(query, [tenantId]);
    return result.rows;
  }

  /**
   * Find combo by ID with items
   */
  static async findById(comboId) {
    const query = `
      SELECT 
        co.*,
        json_agg(
          json_build_object(
            'id', ci.id,
            'menu_item_id', ci.menu_item_id,
            'quantity', ci.quantity,
            'item_name', mi.name,
            'item_price', mi.price,
            'item_image', mi.image_url
          ) ORDER BY ci.created_at
        ) FILTER (WHERE ci.id IS NOT NULL) as items
      FROM combo_offers co
      LEFT JOIN combo_items ci ON co.id = ci.combo_id
      LEFT JOIN menu_items mi ON ci.menu_item_id = mi.id
      WHERE co.id = $1
      GROUP BY co.id
    `;
    const result = await db.query(query, [comboId]);
    return result.rows[0];
  }

  /**
   * Create a new combo offer
   */
  static async create(comboData) {
    const { tenant_id, name, description, combo_price, original_price, image_url, valid_from, valid_until } = comboData;
    
    const query = `
      INSERT INTO combo_offers (
        tenant_id, name, description, combo_price, original_price, 
        image_url, valid_from, valid_until
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;
    
    const result = await db.query(query, [
      tenant_id, name, description, combo_price, original_price,
      image_url, valid_from, valid_until
    ]);
    
    return result.rows[0].id;
  }

  /**
   * Add items to a combo
   */
  static async addItems(comboId, items) {
    const values = items.map((item, index) => {
      const offset = index * 3;
      return `($${offset + 1}, $${offset + 2}, $${offset + 3})`;
    }).join(', ');

    const params = items.flatMap(item => [comboId, item.menu_item_id, item.quantity || 1]);

    const query = `
      INSERT INTO combo_items (combo_id, menu_item_id, quantity)
      VALUES ${values}
      RETURNING id
    `;

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Update combo offer
   */
  static async updateById(comboId, updates) {
    const fields = [];
    const values = [];
    let paramCount = 1;

    Object.keys(updates).forEach(key => {
      if (updates[key] !== undefined) {
        fields.push(`${key} = $${paramCount}`);
        values.push(updates[key]);
        paramCount++;
      }
    });

    if (fields.length === 0) return;

    values.push(comboId);
    const query = `
      UPDATE combo_offers
      SET ${fields.join(', ')}
      WHERE id = $${paramCount}
    `;

    await db.query(query, values);
  }

  /**
   * Delete combo items
   */
  static async deleteItems(comboId) {
    const query = 'DELETE FROM combo_items WHERE combo_id = $1';
    await db.query(query, [comboId]);
  }

  /**
   * Delete combo offer
   */
  static async deleteById(comboId) {
    const query = 'DELETE FROM combo_offers WHERE id = $1';
    await db.query(query, [comboId]);
  }

  /**
   * Calculate original price from items
   */
  static async calculateOriginalPrice(items) {
    if (!items || items.length === 0) return 0;

    const itemIds = items.map(item => item.menu_item_id);
    const query = `
      SELECT id, price FROM menu_items WHERE id = ANY($1)
    `;
    
    const result = await db.query(query, [itemIds]);
    const priceMap = {};
    result.rows.forEach(row => {
      priceMap[row.id] = parseFloat(row.price);
    });

    let total = 0;
    items.forEach(item => {
      const price = priceMap[item.menu_item_id] || 0;
      const quantity = item.quantity || 1;
      total += price * quantity;
    });

    return total;
  }
}

module.exports = ComboRepository;
