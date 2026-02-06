-- Migration 003: Business Reports Module
-- Reports configuration table
CREATE TABLE IF NOT EXISTS report_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  report_type TEXT NOT NULL,
  config_data TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Daily aggregated stats for performance
CREATE TABLE IF NOT EXISTS daily_order_stats (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  date DATE NOT NULL,
  total_orders INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  avg_order_value DECIMAL(10,2) DEFAULT 0,
  orders_by_status TEXT,
  orders_by_source TEXT,
  top_items TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, date)
);

-- Indexes for reporting performance
CREATE INDEX IF NOT EXISTS idx_daily_stats_tenant_date ON daily_order_stats(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_orders_created_date ON orders(tenant_id, DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_orders_revenue ON orders(tenant_id, total_amount, DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_order_items_revenue ON order_items(order_id, quantity, price_snapshot);