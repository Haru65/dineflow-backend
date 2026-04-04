-- Migration: Add Combo Offers Feature
-- Description: Create tables for combo offers (bundled menu items with special pricing)

-- Create combo_offers table
CREATE TABLE IF NOT EXISTS combo_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  combo_price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  valid_from TIMESTAMP,
  valid_until TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create combo_items junction table (links combos to menu items)
CREATE TABLE IF NOT EXISTS combo_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id UUID NOT NULL REFERENCES combo_offers(id) ON DELETE CASCADE,
  menu_item_id TEXT NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1 CHECK (quantity > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_combo_offers_tenant ON combo_offers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_combo_offers_active ON combo_offers(is_active);
CREATE INDEX IF NOT EXISTS idx_combo_items_combo ON combo_items(combo_id);
CREATE INDEX IF NOT EXISTS idx_combo_items_menu_item ON combo_items(menu_item_id);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_combo_offers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER combo_offers_updated_at
BEFORE UPDATE ON combo_offers
FOR EACH ROW
EXECUTE FUNCTION update_combo_offers_updated_at();

-- Add comments for documentation
COMMENT ON TABLE combo_offers IS 'Stores combo offers (bundled menu items with special pricing)';
COMMENT ON TABLE combo_items IS 'Junction table linking combo offers to menu items';
COMMENT ON COLUMN combo_offers.combo_price IS 'Special discounted price for the combo';
COMMENT ON COLUMN combo_offers.original_price IS 'Sum of individual item prices (for showing savings)';
COMMENT ON COLUMN combo_items.quantity IS 'Number of this menu item included in the combo';
