-- New Features Migration
-- Adds: Offers, Receptionist QR, Menu item editing

-- Create offers table
CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  discount_percentage REAL,
  discount_amount REAL,
  valid_from DATETIME,
  valid_until DATETIME,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create receptionist QR table
CREATE TABLE IF NOT EXISTS receptionist_qr (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  identifier TEXT NOT NULL,
  qr_url TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE,
  UNIQUE (tenant_id, identifier)
);

-- Add quick_action column to menu_items for quick buttons like "Water"
CREATE TABLE IF NOT EXISTS quick_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  name TEXT NOT NULL,
  icon TEXT,
  price REAL,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_offers_tenant ON offers(tenant_id);
CREATE INDEX IF NOT EXISTS idx_offers_active ON offers(is_active);
CREATE INDEX IF NOT EXISTS idx_receptionist_qr_tenant ON receptionist_qr(tenant_id);
CREATE INDEX IF NOT EXISTS idx_quick_actions_tenant ON quick_actions(tenant_id);
