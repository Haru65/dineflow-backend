-- Add table_type column to restaurant_tables
-- This allows distinguishing between regular dining tables and receptionist/counter tables

ALTER TABLE restaurant_tables ADD COLUMN table_type TEXT DEFAULT 'regular';

-- Create index for faster filtering
CREATE INDEX IF NOT EXISTS idx_restaurant_tables_type ON restaurant_tables(tenant_id, table_type);
