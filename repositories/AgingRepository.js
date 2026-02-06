const { dbAll, dbRun, dbGet } = require('../database');
const { generateId } = require('../utils/helpers');

class AgingRepository {
  static async getThresholds(tenantId) {
    const query = `
      SELECT * FROM aging_thresholds 
      WHERE tenant_id = ? AND is_active = 1
    `;
    
    const row = await dbGet(query, [tenantId]);
    return row || { warning_minutes: 5, critical_minutes: 20 };
  }
  
  static async updateThresholds(tenantId, thresholds) {
    const { warning_minutes, critical_minutes } = thresholds;
    
    const query = `
      INSERT OR REPLACE INTO aging_thresholds 
      (id, tenant_id, warning_minutes, critical_minutes, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `;
    
    const result = await dbRun(query, [
      `aging_${tenantId}`,
      tenantId,
      warning_minutes,
      critical_minutes
    ]);
    
    return result.changes;
  }
  
  static async getOrdersWithAging(tenantId) {
    const query = `
      SELECT 
        o.*,
        (julianday('now') - julianday(o.status_changed_at)) * 24 * 60 as minutes_elapsed,
        at.warning_minutes,
        at.critical_minutes
      FROM orders o
      LEFT JOIN aging_thresholds at ON o.tenant_id = at.tenant_id
      WHERE o.tenant_id = ? 
      AND o.status IN ('pending', 'confirmed', 'cooking', 'ready')
      ORDER BY o.created_at DESC
    `;
    
    const rows = await dbAll(query, [tenantId]);
    
    // Calculate aging level for each order
    const ordersWithAging = rows.map(order => {
      const minutesElapsed = Math.floor(order.minutes_elapsed || 0);
      const warningMinutes = order.warning_minutes || 5;
      const criticalMinutes = order.critical_minutes || 20;
      
      let agingLevel = 'fresh';
      if (minutesElapsed >= criticalMinutes) {
        agingLevel = 'critical';
      } else if (minutesElapsed >= warningMinutes) {
        agingLevel = 'warning';
      }
      
      return {
        ...order,
        minutes_elapsed: minutesElapsed,
        aging_level: agingLevel
      };
    });
    
    return ordersWithAging;
  }
}

module.exports = AgingRepository;