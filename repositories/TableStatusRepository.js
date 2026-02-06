const { dbAll, dbRun, dbGet } = require('../database');

class TableStatusRepository {
  static async getTableStatusByTenant(tenantId) {
    const query = `
      SELECT 
        t.id,
        t.tenant_id,
        t.name,
        t.identifier,
        t.qr_url,
        t.is_active,
        t.current_status,
        t.active_orders_count,
        t.last_order_time,
        COUNT(o.id) as total_active_orders,
        COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
        COUNT(CASE WHEN o.status IN ('confirmed', 'cooking') THEN 1 END) as processing_orders,
        COUNT(CASE WHEN o.status = 'ready' THEN 1 END) as ready_orders,
        MAX(o.created_at) as latest_order_time,
        MIN(o.status_changed_at) as oldest_order_time
      FROM restaurant_tables t
      LEFT JOIN orders o ON t.id = o.table_id 
        AND o.status IN ('pending', 'confirmed', 'cooking', 'ready')
      WHERE t.tenant_id = ? AND t.is_active = 1
      GROUP BY t.id
      ORDER BY t.name
    `;
    
    const rows = await dbAll(query, [tenantId]);
    
    // Calculate status for each table
    const tablesWithStatus = rows.map(table => {
      let status = 'available';
      let statusColor = 'gray';
      let statusIcon = 'circle';
      
      if (table.total_active_orders > 0) {
        if (table.pending_orders > 0) {
          status = 'pending_orders';
          statusColor = 'yellow';
          statusIcon = 'clock';
        } else if (table.ready_orders > 0) {
          status = 'ready_orders';
          statusColor = 'green';
          statusIcon = 'check-circle';
        } else {
          status = 'processing_orders';
          statusColor = 'blue';
          statusIcon = 'cooking';
        }
      }
      
      return {
        ...table,
        status,
        status_color: statusColor,
        status_icon: statusIcon,
        has_overdue: table.oldest_order_time ? 
          (new Date() - new Date(table.oldest_order_time)) > (20 * 60 * 1000) : false
      };
    });
    
    return tablesWithStatus;
  }
  
  static async updateTableStatus(tableId, status) {
    const query = `
      UPDATE restaurant_tables 
      SET current_status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    
    const result = await dbRun(query, [status, tableId]);
    return result.changes;
  }
  
  static async refreshTableCounts(tenantId) {
    const query = `
      UPDATE restaurant_tables 
      SET 
        active_orders_count = (
          SELECT COUNT(*) FROM orders 
          WHERE table_id = restaurant_tables.id 
          AND status IN ('pending', 'confirmed', 'cooking', 'ready')
        ),
        current_status = CASE 
          WHEN (
            SELECT COUNT(*) FROM orders 
            WHERE table_id = restaurant_tables.id 
            AND status IN ('pending', 'confirmed', 'cooking', 'ready')
          ) > 0 THEN 'occupied'
          ELSE 'available'
        END,
        updated_at = CURRENT_TIMESTAMP
      WHERE tenant_id = ?
    `;
    
    const result = await dbRun(query, [tenantId]);
    return result.changes;
  }
}

module.exports = TableStatusRepository;