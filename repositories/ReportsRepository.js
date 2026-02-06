const { dbAll, dbRun, dbGet } = require('../database');

class ReportsRepository {
  static async getOrderReport(tenantId, startDate, endDate, filters = {}) {
    let whereClause = 'WHERE o.tenant_id = ? AND DATE(o.created_at) BETWEEN ? AND ?';
    const params = [tenantId, startDate, endDate];
    
    if (filters.source_type) {
      whereClause += ' AND o.source_type = ?';
      params.push(filters.source_type);
    }
    
    if (filters.status) {
      whereClause += ' AND o.status = ?';
      params.push(filters.status);
    }
    
    const query = `
      SELECT 
        DATE(o.created_at) as date,
        COUNT(*) as total_orders,
        SUM(o.total_amount) as revenue,
        AVG(o.total_amount) as avg_order_value,
        COUNT(CASE WHEN o.status = 'completed' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN o.status = 'cancelled' THEN 1 END) as cancelled_orders,
        COUNT(CASE WHEN o.source_type = 'table' THEN 1 END) as table_orders,
        COUNT(CASE WHEN o.source_type = 'zomato' THEN 1 END) as zomato_orders,
        COUNT(CASE WHEN o.source_type = 'swiggy' THEN 1 END) as swiggy_orders,
        SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END) as paid_revenue,
        COUNT(CASE WHEN o.payment_status = 'paid' THEN 1 END) as paid_orders
      FROM orders o
      ${whereClause}
      GROUP BY DATE(o.created_at)
      ORDER BY date DESC
    `;
    
    const dailyData = await dbAll(query, params);
    
    // Calculate summary statistics
    const summary = {
      total_orders: dailyData.reduce((sum, day) => sum + day.total_orders, 0),
      total_revenue: dailyData.reduce((sum, day) => sum + (day.revenue || 0), 0),
      avg_order_value: dailyData.length > 0 ? 
        dailyData.reduce((sum, day) => sum + (day.revenue || 0), 0) / 
        dailyData.reduce((sum, day) => sum + day.total_orders, 0) : 0,
      completion_rate: dailyData.length > 0 ?
        (dailyData.reduce((sum, day) => sum + day.completed_orders, 0) / 
         dailyData.reduce((sum, day) => sum + day.total_orders, 0)) * 100 : 0
    };
    
    // Source distribution for pie chart
    const sourceDistribution = [
      { 
        name: 'Table Orders', 
        value: dailyData.reduce((sum, day) => sum + day.table_orders, 0),
        color: '#3B82F6'
      },
      { 
        name: 'Zomato', 
        value: dailyData.reduce((sum, day) => sum + day.zomato_orders, 0),
        color: '#EF4444'
      },
      { 
        name: 'Swiggy', 
        value: dailyData.reduce((sum, day) => sum + day.swiggy_orders, 0),
        color: '#F97316'
      }
    ].filter(item => item.value > 0);
    
    return {
      daily_data: dailyData,
      summary,
      source_distribution: sourceDistribution
    };
  }
  
  static async getRevenueReport(tenantId, period = 'daily', startDate, endDate) {
    const dateFormat = period === 'monthly' ? '%Y-%m' : 
                      period === 'weekly' ? '%Y-%W' : '%Y-%m-%d';
    
    const query = `
      SELECT 
        strftime('${dateFormat}', o.created_at) as period,
        COUNT(*) as total_orders,
        SUM(o.total_amount) as total_revenue,
        SUM(o.tax_amount) as total_tax,
        SUM(o.discount_amount) as total_discount,
        AVG(o.total_amount) as avg_order_value,
        MIN(o.total_amount) as min_order_value,
        MAX(o.total_amount) as max_order_value,
        COUNT(CASE WHEN o.payment_status = 'paid' THEN 1 END) as paid_orders,
        SUM(CASE WHEN o.payment_status = 'paid' THEN o.total_amount ELSE 0 END) as paid_revenue
      FROM orders o
      WHERE o.tenant_id = ? 
        AND DATE(o.created_at) BETWEEN ? AND ?
        AND o.status IN ('completed', 'served')
      GROUP BY strftime('${dateFormat}', o.created_at)
      ORDER BY period DESC
    `;
    
    const data = await dbAll(query, [tenantId, startDate, endDate]);
    
    // Calculate trends (compare with previous period)
    const summary = {
      total_revenue: data.reduce((sum, period) => sum + (period.total_revenue || 0), 0),
      total_orders: data.reduce((sum, period) => sum + period.total_orders, 0),
      avg_order_value: data.length > 0 ? 
        data.reduce((sum, period) => sum + (period.total_revenue || 0), 0) / 
        data.reduce((sum, period) => sum + period.total_orders, 0) : 0,
      payment_success_rate: data.length > 0 ?
        (data.reduce((sum, period) => sum + period.paid_orders, 0) / 
         data.reduce((sum, period) => sum + period.total_orders, 0)) * 100 : 0
    };
    
    return {
      data,
      summary,
      period
    };
  }
  
  static async getProductReport(tenantId, startDate, endDate) {
    const query = `
      SELECT 
        mi.id,
        mi.name,
        mc.name as category_name,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.price_snapshot) as total_revenue,
        COUNT(DISTINCT o.id) as order_count,
        AVG(oi.price_snapshot) as avg_price,
        mi.price as current_price,
        mi.is_veg,
        mi.is_spicy
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE o.tenant_id = ? 
        AND DATE(o.created_at) BETWEEN ? AND ?
        AND o.status IN ('completed', 'served')
      GROUP BY mi.id
      ORDER BY total_quantity DESC
    `;
    
    const items = await dbAll(query, [tenantId, startDate, endDate]);
    
    // Category-wise analysis
    const categoryQuery = `
      SELECT 
        mc.name as category_name,
        COUNT(DISTINCT mi.id) as item_count,
        SUM(oi.quantity) as total_quantity,
        SUM(oi.quantity * oi.price_snapshot) as total_revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      JOIN menu_categories mc ON mi.category_id = mc.id
      WHERE o.tenant_id = ? 
        AND DATE(o.created_at) BETWEEN ? AND ?
        AND o.status IN ('completed', 'served')
      GROUP BY mc.id
      ORDER BY total_revenue DESC
    `;
    
    const categories = await dbAll(categoryQuery, [tenantId, startDate, endDate]);
    
    return {
      items,
      categories,
      summary: {
        total_items_sold: items.reduce((sum, item) => sum + item.total_quantity, 0),
        total_revenue: items.reduce((sum, item) => sum + (item.total_revenue || 0), 0),
        unique_items: items.length,
        top_item: items[0] || null
      }
    };
  }
  
  static async getDashboardMetrics(tenantId, days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const endDate = new Date();
    
    // Recent orders
    const recentOrdersQuery = `
      SELECT COUNT(*) as count
      FROM orders 
      WHERE tenant_id = ? 
        AND created_at >= datetime('now', '-${days} days')
    `;
    
    // Revenue metrics
    const revenueQuery = `
      SELECT 
        SUM(total_amount) as total_revenue,
        AVG(total_amount) as avg_order_value,
        COUNT(*) as total_orders
      FROM orders 
      WHERE tenant_id = ? 
        AND created_at >= datetime('now', '-${days} days')
        AND status IN ('completed', 'served')
        AND payment_status = 'paid'
    `;
    
    // Top items
    const topItemsQuery = `
      SELECT 
        mi.name,
        SUM(oi.quantity) as quantity
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE o.tenant_id = ? 
        AND o.created_at >= datetime('now', '-${days} days')
        AND o.status IN ('completed', 'served')
      GROUP BY mi.id
      ORDER BY quantity DESC
      LIMIT 5
    `;
    
    const [recentOrders, revenue, topItems] = await Promise.all([
      dbGet(recentOrdersQuery, [tenantId]),
      dbGet(revenueQuery, [tenantId]),
      dbAll(topItemsQuery, [tenantId])
    ]);
    
    return {
      recent_orders: recentOrders?.count || 0,
      total_revenue: revenue?.total_revenue || 0,
      avg_order_value: revenue?.avg_order_value || 0,
      total_orders: revenue?.total_orders || 0,
      top_items: topItems || []
    };
  }
}

module.exports = ReportsRepository;