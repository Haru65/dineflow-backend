-- Migration 001: Color System and Order Aging
-- Add aging tracking to orders
ALTER TABLE orders ADD COLUMN status_changed_at DATETIME;
ALTER TABLE orders ADD COLUMN aging_level TEXT DEFAULT 'fresh';

-- Add aging configuration
CREATE TABLE aging_thresholds (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  warning_minutes INTEGER DEFAULT 5,
  critical_minutes INTEGER DEFAULT 20,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (tenant_id)
);

-- Insert default aging thresholds for existing tenants
INSERT INTO aging_thresholds (id, tenant_id, warning_minutes, critical_minutes)
SELECT 
  'aging_' || id,
  id,
  5,
  20
FROM tenants;

-- Create trigger for status change tracking
CREATE TRIGGER update_order_status_timestamp 
AFTER UPDATE OF status ON orders
BEGIN
  UPDATE orders 
  SET status_changed_at = CURRENT_TIMESTAMP,
      aging_level = 'fresh'
  WHERE id = NEW.id;
END;

-- Update existing orders with current timestamp
UPDATE orders 
SET status_changed_at = COALESCE(updated_at, created_at)
WHERE status_changed_at IS NULL;

-- Add indexes for performance
CREATE INDEX idx_orders_aging ON orders(tenant_id, aging_level, status_changed_at);
CREATE INDEX idx_aging_thresholds_tenant ON aging_thresholds(tenant_id);