-- Migration 002: Table Status Indicators
-- Add table status fields
ALTER TABLE restaurant_tables ADD COLUMN current_status TEXT DEFAULT 'available';
ALTER TABLE restaurant_tables ADD COLUMN active_orders_count INTEGER DEFAULT 0;
ALTER TABLE restaurant_tables ADD COLUMN last_order_time DATETIME;

-- Create table status view
CREATE VIEW table_status_view AS
SELECT 
  t.id,
  t.tenant_id,
  t.name,
  t.identifier,
  t.is_active,
  t.current_status,
  t.active_orders_count,
  t.last_order_time,
  COUNT(o.id) as total_orders,
  COUNT(CASE WHEN o.status IN ('pending', 'confirmed', 'cooking') THEN 1 END) as active_orders,
  COUNT(CASE WHEN o.status = 'pending' THEN 1 END) as pending_orders,
  MAX(o.created_at) as latest_order_time
FROM restaurant_tables t
LEFT JOIN orders o ON t.id = o.table_id AND o.status IN ('pending', 'confirmed', 'cooking', 'ready')
WHERE t.is_active = 1
GROUP BY t.id;

-- Update existing table statuses
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
  END;

-- Create trigger for table status updates
CREATE TRIGGER update_table_status_on_order_change
AFTER INSERT ON orders
BEGIN
  UPDATE restaurant_tables 
  SET 
    active_orders_count = (
      SELECT COUNT(*) FROM orders 
      WHERE table_id = NEW.table_id 
      AND status IN ('pending', 'confirmed', 'cooking', 'ready')
    ),
    last_order_time = NEW.created_at,
    current_status = CASE 
      WHEN (SELECT COUNT(*) FROM orders WHERE table_id = NEW.table_id AND status IN ('pending', 'confirmed', 'cooking', 'ready')) > 0 
      THEN 'occupied'
      ELSE 'available'
    END
  WHERE id = NEW.table_id;
END;

-- Add indexes
CREATE INDEX idx_table_status ON restaurant_tables(tenant_id, current_status);
CREATE INDEX idx_table_orders ON restaurant_tables(tenant_id, active_orders_count);